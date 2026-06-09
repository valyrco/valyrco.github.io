# VALYR — Frontend premium

Arquitectura: GitHub Pages + Google Sheets + Cloudinary + WhatsApp.

## Columnas recomendadas en Google Sheets

`id,activo,destacado,nombre,marca,categoria,genero,precio,moneda,tallas,color,estado,imagen_frontal,imagen_trasera,imagenes_extra,descripcion,drop,orden,whatsapp`

- `genero`: HOMBRE, MUJER o UNISEX.
- `imagenes_extra`: enlaces separados por `|` para más fotos por producto.
- `imagen_frontal` e `imagen_trasera`: imágenes principales.

## Funcionamiento

- Catálogo completo en `catalogo.html`.
- Detalle de producto en `producto.html?id=VLR-001`.
- Reserva por WhatsApp.
- Políticas comerciales se coordinan directamente por WhatsApp.


VALYR FRONTEND v29 — CATEGORÍAS DINÁMICAS

Nuevo:
- Los filtros del catálogo ya no dependen de categorías predeterminadas.
- La web intenta leer la pestaña CATEGORIAS del mismo Google Sheets.
- Si la pestaña CATEGORIAS no existe, deriva las categorías de las prendas activas.
- Si creas PANTALONES, SHORTS, SUÉTER o cualquier categoría en el Admin, aparecerá en filtros.
