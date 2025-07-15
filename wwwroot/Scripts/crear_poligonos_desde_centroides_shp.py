import geopandas as gpd
from shapely.geometry import Polygon
from osgeo import gdal
import os

nombre_archivo = "1984_F_E005M_guia_centroides"
nombre_carpeta = "1984_F_E005M"

shapefile_path = f"/var/www/html/fototeca/images/{nombre_carpeta}/centroides/{nombre_archivo}.shp"
carpeta_imagenes = f"/var/www/html/fototeca/images/{nombre_carpeta}"
carpeta_salida = f"/var/www/html/fototeca/images/{nombre_carpeta}/poligonos"


# Leer shapefile original
gdf_centroides = gpd.read_file(shapefile_path)
crs = gdf_centroides.crs

nuevos_poligonos = []

for idx, row in gdf_centroides.iterrows():
    imagen = row["location"]
    id_val = row["id"]

    ruta_jpg = os.path.join(carpeta_imagenes, imagen)
    ruta_jgw = ruta_jpg.replace(".jpg", ".jgw")

    if not os.path.exists(ruta_jpg) or not os.path.exists(ruta_jgw):
        print(f"❌ Faltan archivos para: {imagen}")
        continue

    # Leer tamaño de la imagen con GDAL
    ds = gdal.Open(ruta_jpg)
    if ds is None:
        print(f"⚠️ No se pudo abrir la imagen con GDAL de: {imagen}")
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

# Guardar nuevo shapefile
nombre_base = nombre_archivo.removesuffix("_centroides") # Quita el "_centroides"
salida_shapefile = os.path.join(carpeta_salida, f"{nombre_base}_poligonos.shp")
gdf_poligonos.to_file(salida_shapefile)

print(f"✅ Shapefile de polígonos creado en: {salida_shapefile}")
