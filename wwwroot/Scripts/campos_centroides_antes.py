import geopandas as gpd
import os

nombre_archivo = "1984_F_E005M_guia"
extension_a_buscar = ".jpg"
nombre_column_location = "N_FOTO_TIF"

shapefile_path = nombre_archivo + ".shp"
#carpeta_imagenes = "./imagenes"  # Cambia esto a la ruta real
carpeta_imagenes = "." #Esto es la misma carpeta donde esta el .py

gdf = gpd.read_file(shapefile_path)

print(gdf.crs)

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

#Añade una nueva columna accediendo a X columna y aplicando una funcion
gdf["location"] = gdf[nombre_column_location].apply(buscar_imagen_por_foto)

#Añade la columna id comenzando desde 1
gdf["id"] = range(1, len(gdf) + 1)

#Por si quieres cambiar el nombre de una columna a otra
#gdf = gdf.rename(columns={"OBJECTID": "id"})

#Por si quieres eliminar una columna
#gdf = gdf.drop(columns=[duplicados_nombre_column_location])

# Detectar duplicados en 'location'
duplicados_location = gdf[gdf["location"].duplicated(keep=False)]

if not duplicados_location.empty:
    print("⚠️ Se encontraron filas con 'location' duplicado:")
    print(duplicados_location[["id", "location"]])
else:
    print("✅ No se encontraron duplicados en 'location'.")

# Detectar duplicados en nombre_column_location
duplicados_nombre_column_location = gdf[gdf[nombre_column_location].duplicated(keep=False)]

if not duplicados_nombre_column_location.empty:
    print("⚠️ Se encontraron filas con duplicado en ", nombre_column_location)
    print(duplicados_nombre_column_location[["id", nombre_column_location]])
else:
    print("✅ No se encontraron duplicados en ", nombre_column_location)

#gdf.to_file(nombre_archivo + "_centroides.shp")

print("✅ Shapefile creado correctamente con la columna 'location' e 'id'.")