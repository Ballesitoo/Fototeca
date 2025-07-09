/** @type {any} */
const JSZip = window.JSZip;

window.mapApp = {
    initMap: function (targetId, dotNetHelper) {
      // Definir la proyección EPSG:25831 con proj4
      proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs");
      ol.proj.proj4.register(proj4);
  
      ol.proj.get('EPSG:25831').setExtent([0, 0, 1000000, 10000000]);
  
      // Capa base WMS GOIB
      const mapaBaseGOIB = new ol.layer.Tile({
        source: new ol.source.TileWMS({
          url: 'https://ideib.caib.es/geoserveis/services/public/GOIB_MapaBase_IB/MapServer/WMSServer',
          params: { 
            'LAYERS': '0', 
            'TILED': true, 
            'FORMAT': 'image/png', 
            'VERSION': '1.3.0' 
          },
          attributions: '<a href="https://ideib.caib.es/visor/" target="_blank">© Govern de les Illes Balears - IDEIB</a>',
          projection: 'EPSG:25831'
        }),
        title: 'Mapa Base GOIB',
        type: 'base',
        visible: true
      });
  
      // Fuente centroides desde GeoServer de 2012_F_E001M_Carret_Llucm-Campos_Centroides (WFS GeoJSON)
      const vectorSourceCentroids = new ol.source.Vector({
        url: 'http://192.168.1.60:8090/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=fototeca:2012_F_E001M_Carret_Llucm-Campos_Centroides&outputFormat=application/json&srsName=EPSG:25831',
        format: new ol.format.GeoJSON()
      });
  
      // Capa centroides
      const centroidLayer = new ol.layer.Vector({
        source: vectorSourceCentroids,
        style: function (feature) {
          const id = feature.get('id');
          const isClicado = clicados.has(id);
          // Ejemplo de estilo simple
          return new ol.style.Style({
            image: new ol.style.Circle({
              radius: 4,
              fill: new ol.style.Fill({ color: isClicado ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 0, 255, 0.4)' }),
              stroke: new ol.style.Stroke({ color: isClicado ? 'red' : 'blue', width: 1 })
            })
          });
        },
        zIndex: 1000
      });

      window._centroidLayer = centroidLayer;
  
      // Fuente polígonos desde GeoServer de 2012_F_E001M_Carret_Llucm-Campos_Poligonos (WFS GeoJSON)
      const polygonSource = new ol.source.Vector({
        url: 'http://192.168.1.60:8090/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=fototeca:2012_F_E001M_Carret_Llucm-Campos_Poligonos&outputFormat=application/json&srsName=EPSG:25831',
        format: new ol.format.GeoJSON()
      });

      window._polygonSource = polygonSource;

      // Capa de polígonos (invisible inicialmente)
      const polygonLayer = new ol.layer.Vector({
        source: polygonSource,
        style: null,
        visible: true
      });
  
      // Crear mapa con capas y vista
      const map = new ol.Map({
        target: targetId,
        layers: [
          mapaBaseGOIB,
          polygonLayer,
          centroidLayer
        ],
        view: new ol.View({
          center: [491414.43, 4383367.44], // Coordenadas centradas en Mallorca (EPSG:25831)
          zoom: 8.5,
          projection: 'EPSG:25831'
        })
      });

      window._olMap = map;

      map.on('click', function (event) {
        map.forEachFeatureAtPixel(event.pixel, function (feature) {
          const location = feature.get('location');
          const geometry = feature.getGeometry();
          const id = feature.get('id');
      
          if (location && geometry && id) {
            // 🔄 Llamada a Blazor
            dotNetHelper.invokeMethodAsync('Click', location, id);
      
            // ✅ Si ya hay una imagen con esta location, no añadirla de nuevo
            const existing = map.getLayers().getArray().find(layer => layer.get('imageLocation') === location);
            if (existing) return;
      
            // ✅ Buscar el polígono asociado al centroide
            const polygonGeometry = getPoligonFromCentroid(feature);
            if (polygonGeometry) {
              const extent = polygonGeometry.getExtent();
              if (extent[0] !== extent[2] && extent[1] !== extent[3]) {
                // ✅ Crear capa WMS para mostrar imagen recortada
                const imageLayer = new ol.layer.Image({
                  source: new ol.source.ImageWMS({
                    url: 'http://192.168.1.60:8090/geoserver/fototeca/wms',
                    params: {
                      'LAYERS': 'fototeca:2012_F_E001M_Carret_Llucm-Campos_Mosaico',
                      'CQL_FILTER': `location='${location}'`,
                      'FORMAT': 'image/jpeg',
                      'VERSION': '1.3.0',
                      'CRS': 'EPSG:25831'
                    },
                    serverType: 'geoserver',
                    crossOrigin: 'anonymous'
                  }),
                  extent: extent,
                  projection: 'EPSG:25831'
                });
      
                imageLayer.set('imageLocation', location);
                map.addLayer(imageLayer);
              }
            }
      
            // ✅ Refrescar capa de centroides si es necesario
            clicados.add(id);
            centroidLayer.getSource().changed();
          }
        });
      });      

      // Variable para la capa de contorno (solo la capa que aparecerá al pasar el ratón)
      let contourLayer = null;
      const clicados = new Set();

      window._clicadosSet = clicados;

      // Función para obtener el polígono correspondiente al centroide
      function getPoligonFromCentroid(centroidFeature) {
        const id = centroidFeature.get('id');  // Usar id en lugar de location
        //console.log('Buscando polígono con id:', id);

        // Asegurémonos de que los datos sean correctos
        const allPolygons = polygonSource.getFeatures();
        //console.log('Número de polígonos disponibles:', allPolygons.length);

        // Buscar el polígono asociado por la propiedad 'id'
        const matchedPolygon = allPolygons.find(f => {
          const polygonId = f.get('id');
          //console.log(`Comparando id: centroide=${id}, polígono=${polygonId}`);
          return polygonId === id;  // Comparar por id
        });

        if (matchedPolygon) {
          //console.log('Polígono encontrado:', matchedPolygon);
          return matchedPolygon.getGeometry();
        } else {
          //console.log('No se encontró polígono para id:', id);
          return null;
        }
      }
      
      // Pasar el raton por encima del centroide para mostrar el contorno del poligono correspondiente a ese centroide
      map.on('pointermove', function (event) {
        const pixel = map.getEventPixel(event.originalEvent);
        const feature = map.forEachFeatureAtPixel(pixel, function (feature) {
          return feature;
        });
      
        // Eliminar cualquier capa de contorno existente
        if (contourLayer) {
          map.removeLayer(contourLayer);
          contourLayer = null;
        }
      
        if (feature && feature.getGeometry().getType() === 'Point') {
          const centroidProps = feature.getProperties();
          const polygonGeometry = getPoligonFromCentroid(feature);
      
          if (polygonGeometry) {
            contourLayer = new ol.layer.Vector({
              source: new ol.source.Vector({
                features: [new ol.Feature({ geometry: polygonGeometry })]
              }),
              style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                  color: 'red',
                  width: 0.7
                }),
                fill: new ol.style.Fill({
                  color: 'rgba(0, 0, 0, 0)'
                })
              })
            });
      
            map.addLayer(contourLayer);
      
            //Esto va con el metodo HoverCentroide en Home.razor, cuidado no borrar por si se necesita mas adelante

            /*// ✅ Opcional: Llamar a Blazor (pasar id o location al vuelo)
            const location = centroidProps.location;
            const id = centroidProps.id;
      
            if ((location != null) && (id != null)) {
              dotNetHelper.invokeMethodAsync('HoverCentroide', location, id);
            }*/
          }
        }
      });
    }
  };

window.MapaInterop = {
  // Funcion para hacer visible o no X fotograma
  toggleLayerVisibility: function (location) {
      const map = window._olMap; // Acceder al mapa global
      if (!map) {
          console.error("El mapa aún no está inicializado.");
          return;
      }

      const layers = map.getLayers().getArray();

      const layer = layers.find(l => l.get('imageLocation') === location);
      if (!layer) return;

      const currentVisibility = layer.getVisible();
      layer.setVisible(!currentVisibility);
  },
  // Funcion para hacer zoom a X fotograma
  ZoomToImage: function (id) {
    const map = window._olMap; // Acceder al mapa global
    const polygonSource = window._polygonSource;
      if (!map || !polygonSource) {
          console.error("El mapa y/o fuente de los polígonos aún no está inicializado.");
          return;
      }

    const polygon = polygonSource.getFeatures().find(f => f.get('id') === id);
    if (polygon) {
      const extent = polygon.getGeometry().getExtent();
      map.getView().fit(extent, { duration: 700, padding: [40, 40, 40, 40] });
    } else {
      console.warn(`No se encontró polígono con id=${id}`);
      console.log(polygonSource.getFeatures().map(f => f.getProperties()));
    }
  },
  // Funcion para eliminar X fotograma
  DeleteFotograma: function (location, id) {
    const map = window._olMap;
    const centroidLayer = window._centroidLayer;
    const clicados = window._clicadosSet;

    if (!map || !centroidLayer || !clicados) {
      console.error("Mapa, centroidLayer o clicados no están inicializados.");
      return;
    }

    // Buscar la capa de imagen que tenga ese location
    const layers = map.getLayers().getArray();
    const imageLayer = layers.find(l => l.get('imageLocation') === location);

    if (imageLayer) {
      map.removeLayer(imageLayer);
      clicados.delete(id);
      centroidLayer.getSource().changed();
    }
  },
  // Funcion para descargar los fotogramas en .zip
  DescargarFotogramas: async function (locations) {

    // Que se pase por parametro el string literal del vuelo que habria en el selector del año y luego solo cambiar la carpeta cambiando el nombre de /2012_F_E001M_Carret_Llucm-Campos_jpg/ por el que sea el suyo

    //console.log("Descargando")
    const zip = new window.JSZip();
    const fotogramasArray = Array.isArray(locations) ? locations : Array.from(locations);

    const promises = fotogramasArray.map(async location => {
        const jpgUrl = `http://192.168.1.60:8081/fototeca/images/2012_F_E001M_Carret_Llucm-Campos/${location}`;
        const jgwUrl = `http://192.168.1.60:8081/fototeca/images/2012_F_E001M_Carret_Llucm-Campos/${location.replace('.jpg', '.jgw')}`;
        //images_geoserver
        try {
            const [imageResponse, jgwResponse] = await Promise.all([
                fetch(jpgUrl, { cache: "no-store" }),
                fetch(jgwUrl, { cache: "no-store" })
            ]);

            if (!imageResponse.ok || !jgwResponse.ok) {
                throw new Error("Error descargando archivos");
            }

            const imageBlob = await imageResponse.blob();
            const jgwText = await jgwResponse.text();

            zip.file(location, imageBlob);
            zip.file(location.replace('.jpg', '.jgw'), jgwText);
        } catch (err) {
            console.error(`Error al descargar ${location}`, err);
        }
    });

    await Promise.all(promises);

    try {
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'fotogramas.zip';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 100);
    } catch (error) {
        console.error("Error al generar el ZIP:", error);
    }
  }
};