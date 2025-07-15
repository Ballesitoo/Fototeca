import geopandas as gpd
from shapely.geometry import Polygon
from osgeo import gdal
import os

# Ruta al shapefile de centroides
shapefile_centroides = "2012_F_E001M_centroides.shp"
carpeta = os.path.dirname(os.path.abspath(shapefile_centroides))

# Leer shapefile original
gdf_centroides = gpd.read_file(shapefile_centroides)
crs = gdf_centroides.crs

nuevos_poligonos = []

for idx, row in gdf_centroides.iterrows():
    imagen = row["location"]
    id_val = row["id"]

    ruta_jpg = os.path.join(carpeta, imagen)
    ruta_jgw = ruta_jpg.replace(".jpg", ".jgw")

    if not os.path.exists(ruta_jpg) or not os.path.exists(ruta_jgw):
        print(f"❌ Faltan archivos para: {imagen}")
        continue

    # Leer tamaño de la imagen con GDAL
    ds = gdal.Open(ruta_jpg)
    if ds is None:
        print(f"⚠️ No se pudo abrir la imagen con GDAL: {imagen}")
        continue
    ancho_px = ds.RasterXSize
    alto_px = ds.RasterYSize

    # Leer JGW
    with open(ruta_jgw, "r") as f:
        A = float(f.readline())  # pixel size X
        D = float(f.readline())  # rotation Y
        B = float(f.readline())  # rotation X
        E = float(f.readline())  # pixel size Y
        C = float(f.readline())  # upper left X
        F = float(f.readline())  # upper left Y

    # Calcular esquinas del polígono
    UL = (C, F)
    UR = (C + A * ancho_px, F + B * ancho_px)
    LR = (C + A * ancho_px + D * alto_px, F + B * ancho_px + E * alto_px)
    LL = (C + D * alto_px, F + E * alto_px)

    poligono = Polygon([UL, UR, LR, LL, UL])

    nuevos_poligonos.append({
        "id": id_val,
        "location": imagen,
        "geometry": poligono
    })

# Crear GeoDataFrame y guardar nuevo shapefile
gdf_poligonos = gpd.GeoDataFrame(nuevos_poligonos, crs=crs)
salida = "2012_F_E001M_poligonos.shp"
gdf_poligonos.to_file(salida)

print(f"✅ Shapefile de polígonos creado: {salida}")
