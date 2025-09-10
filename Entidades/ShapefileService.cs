using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using NetTopologySuite.IO;
using NetTopologySuite.Geometries;

public class ShapefileService
{
    // Recibe el path del zip, descomprime y detecta tipo geometría
    public string DetectarTipoGeometria(string zipFilePath)
    {
        // Crear carpeta temporal única
        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempDir);

        try
        {
            // Descomprimir ZIP completo en tempDir
            ZipFile.ExtractToDirectory(zipFilePath, tempDir);

            // Buscar archivo .shp
            var shpFile = Directory.GetFiles(tempDir, "*.shp").FirstOrDefault();
            if (shpFile == null)
                return "No se encontró archivo .shp en el zip.";

            using var reader = new ShapefileDataReader(shpFile, new GeometryFactory());

            if (!reader.Read())
                return "Shapefile vacío";

            var geometryType = reader.Geometry.GeometryType;

            if (geometryType.Equals("Point", StringComparison.OrdinalIgnoreCase) ||
                geometryType.Equals("MultiPoint", StringComparison.OrdinalIgnoreCase))
                return "Centroides";

            if (geometryType.Equals("Polygon", StringComparison.OrdinalIgnoreCase) ||
                geometryType.Equals("MultiPolygon", StringComparison.OrdinalIgnoreCase))
                return "Poligonos";

            return "Tipo de geometría no soportado";
        }
        finally
        {
            // Borrar carpeta temporal con todo
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, true);
        }
    }
}
