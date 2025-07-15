import geopandas as gpd
import os

nombre_archivo = "1984_F_E005M_guia"
extension_a_buscar = ".jpg"
nombre_column_location = "N_FOTO_TIF"
nombre_carpeta = "1984_F_E005M"

shapefile_path = f"/var/www/html/fototeca/images/{nombre_carpeta}/shp_originales/{nombre_archivo}.shp"
carpeta_imagenes = f"/var/www/html/fototeca/images/{nombre_carpeta}"
carpeta_salida = f"/var/www/html/fototeca/images/{nombre_carpeta}/centroides"

# Cargar shapefile original
gdf = gpd.read_file(shapefile_path)

print(gdf.crs)

# Verificar CRS
if gdf.crs is None:
    print("⚠️ CRS no definido. Puedes definirlo con gdf.set_crs('EPSG:XXXX')")
    #gdf.set_crs('EPSG:25831')
else:
    print(f"✅ CRS detectado: {gdf.crs}")

def foto_a_str(foto_num):
    try:
        return str(int(float(foto_num))).strip().lower()
    except:
        return str(foto_num).strip().lower()

def buscar_imagen_por_foto(foto_num):
    foto_str = foto_a_str(foto_num)
    print(f"Buscando imagen para: '{foto_str}'")
    for nombre_archivo in os.listdir(carpeta_imagenes):
        nombre_bajo = nombre_archivo.lower()
        if (
            extension_a_buscar in nombre_bajo
            #Si no quieres que mire X extensiones
            #and not nombre_bajo.endswith((".jpg.ovr", ".jpg.aux.xml"))
            and foto_str in nombre_bajo
        ):
            print(f"  Encontrado: {nombre_archivo}")
            return nombre_archivo
    print("  NO ENCONTRADO")
    return "NO_ENCONTRADO"

# Añade una nueva columna accediendo a X columna y aplicando una funcion
gdf["location"] = gdf[nombre_column_location].apply(buscar_imagen_por_foto)

# Añade la columna id comenzando desde 1
gdf["id"] = range(1, len(gdf) + 1)

# Por si quieres cambiar el nombre de una columna a otra
#gdf = gdf.rename(columns={"OBJECTID": "id"})

# Elimina la columna desde donde busca el nombre de la imagen por que se crea location que es mejor
gdf = gdf.drop(columns=[nombre_column_location])

# Detectar duplicados en 'location'
duplicados_location = gdf[gdf["location"].duplicated(keep=False)]
if not duplicados_location.empty:
    print("⚠️ Se encontraron filas con 'location' duplicado:")
    print(duplicados_location[["id", "location"]])
else:
    print("✅ No se encontraron duplicados en 'location'.")

# Detectar duplicados en columna de foto
duplicados_nombre_column_location = gdf[gdf[nombre_column_location].duplicated(keep=False)]
if not duplicados_nombre_column_location.empty:
    print("⚠️ Se encontraron filas con duplicado en ", nombre_column_location)
    print(duplicados_nombre_column_location[["id", nombre_column_location]])
else:
    print("✅ No se encontraron duplicados en ", nombre_column_location)

# Guardar nuevo shapefile
salida_shapefile = os.path.join(carpeta_salida, f"{nombre_archivo}_centroides.shp")
gdf.to_file(salida_shapefile)

print(f"✅ Shapefile creado correctamente en: {salida_shapefile}")
