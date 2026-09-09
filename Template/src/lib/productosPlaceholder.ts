// TODO(productos): esto lo sirve `GET /productos` cuando exista el dominio en el backend
// (hoy no hay modelo `Producto` en `prisma/schema.prisma` ni modulo que lo exponga). Igual
// que `configuracionPlaceholder`, este archivo es un puente: cuando llegue el endpoint se
// reemplaza por el fetch en `services/productosService.ts` y la pagina no cambia, porque las
// formas de abajo son las que el API va a devolver.
//
// **Es tambien el unico archivo del frontend con rubro.** El resto del template no nombra un
// tipo de negocio (ver SPEC.md, "Producto generico, sin rubro"), y esta pagina lo mantiene
// asi: los componentes renderizan lo que digan estos datos y no saben de cosmetica. Cambiar
// de rubro es reescribir este archivo, no abrir un `.tsx` — que es el criterio que pide
// `05-marca-y-responsive.md`.

export type CategoriaProducto = {
  id: string;
  /** Que tipo de producto es. */
  nombre: string;
  /** Para que sirve, en una linea. Es lo que responde "por que me serviria". */
  promesa: string;
  descripcion: string;
};

export type Producto = {
  id: string;
  nombre: string;
  categoriaId: string;
  descripcion: string;
  /** Cadena, no numero: un `Decimal` viaja asi en el JSON y se formatea sin perder precision. */
  precio: string;
  /** Nulo mientras no haya fotos cargadas; la card cae al monograma y la rejilla no se rompe. */
  imagenUrl: string | null;
  /** Contenido o formato ("50 ml", "barra de 90 g"). */
  presentacion: string;
  /**
   * Si hay stock hoy. Booleano y no una cantidad: el visitante no necesita saber cuantos
   * quedan, y publicar el numero exacto obliga a mantenerlo al dia para que no mienta.
   */
  disponible: boolean;
};

export const categoriasPlaceholder: CategoriaProducto[] = [
  {
    id: 'cat-limpieza',
    nombre: 'Limpieza',
    promesa: 'Retiran el dia sin dejar la piel tirante.',
    descripcion:
      'Lo primero y lo que mas se nota: una piel mal limpiada no absorbe nada de lo que venga despues. Formulas suaves, sin sulfatos agresivos, para usar a diario.',
  },
  {
    id: 'cat-hidratacion',
    nombre: 'Hidratacion',
    promesa: 'Sostienen el agua que la piel ya tiene.',
    descripcion:
      'La textura cambia segun la piel y el clima, no segun el precio: gel para pieles mixtas y crema mas rica para las secas. Ambas se usan manana y noche.',
  },
  {
    id: 'cat-tratamiento',
    nombre: 'Tratamiento',
    promesa: 'Trabajan sobre algo concreto: marcas, textura, brillo.',
    descripcion:
      'Los activos van en dosis util y en envase opaco, que es lo que los mantiene estables. Se suman de a uno y se les da semanas, no dias.',
  },
  {
    id: 'cat-proteccion',
    nombre: 'Proteccion',
    promesa: 'Es lo que hace que el resto valga la pena.',
    descripcion:
      'Sin filtro solar diario, cualquier tratamiento sobre manchas o textura rema contra la corriente. Acabado sin residuo blanco, para que no de pereza usarlo.',
  },
];

export const productosPlaceholder: Producto[] = [
  {
    id: 'prod-gel-limpiador',
    nombre: 'Gel limpiador suave',
    categoriaId: 'cat-limpieza',
    descripcion:
      'Limpia sin sulfatos y respeta la barrera de la piel. Hace poca espuma a proposito: la espuma abundante es tensioactivo de mas, y es lo que deja la cara tirante.',
    precio: '18.50',
    imagenUrl: null,
    disponible: true,
    presentacion: '150 ml',
  },
  {
    id: 'prod-agua-micelar',
    nombre: 'Agua micelar calmante',
    categoriaId: 'cat-limpieza',
    descripcion:
      'Para desmaquillar sin frotar. Con pantenol y sin alcohol, asi que sirve tambien en pieles reactivas y en el contorno de ojos.',
    precio: '15.00',
    imagenUrl: null,
    disponible: true,
    presentacion: '200 ml',
  },
  {
    id: 'prod-crema-ligera',
    nombre: 'Hidratante en gel ligero',
    categoriaId: 'cat-hidratacion',
    descripcion:
      'Acido hialuronico y niacinamida en base acuosa. Se absorbe rapido y no deja pelicula, asi que el protector solar se puede aplicar encima sin apelmazar.',
    precio: '24.00',
    imagenUrl: null,
    disponible: true,
    presentacion: '50 ml',
  },
  {
    id: 'prod-crema-nutritiva',
    nombre: 'Crema nutritiva de noche',
    categoriaId: 'cat-hidratacion',
    descripcion:
      'Mas rica que la de dia, con ceramidas y manteca de karite. Para piel seca todo el ano y para piel normal en invierno o con aire acondicionado.',
    precio: '29.90',
    imagenUrl: null,
    disponible: true,
    presentacion: '50 ml',
  },
  {
    id: 'prod-serum-vitc',
    nombre: 'Serum de vitamina C',
    categoriaId: 'cat-tratamiento',
    descripcion:
      'Al 10%, en envase opaco con gotero. Empareja el tono y aporta luminosidad; se usa de manana y siempre con protector solar encima.',
    precio: '34.00',
    imagenUrl: null,
    disponible: true,
    presentacion: '30 ml',
  },
  {
    id: 'prod-mascarilla-arcilla',
    nombre: 'Mascarilla de arcilla',
    categoriaId: 'cat-tratamiento',
    descripcion:
      'Arcilla verde con avena para que no reseque. Una o dos veces por semana en la zona T; se retira antes de que termine de secarse del todo.',
    precio: '16.50',
    imagenUrl: null,
    disponible: false,
    presentacion: '75 ml',
  },
  {
    id: 'prod-aceite-puntas',
    nombre: 'Aceite reparador de puntas',
    categoriaId: 'cat-tratamiento',
    descripcion:
      'Dos gotas en medios y puntas, con el pelo humedo. Sella la fibra y baja el encrespado sin apelmazar ni apagar el brillo.',
    precio: '21.00',
    imagenUrl: null,
    disponible: true,
    presentacion: '50 ml',
  },
  {
    id: 'prod-protector-spf50',
    nombre: 'Protector solar SPF 50',
    categoriaId: 'cat-proteccion',
    descripcion:
      'Filtro de amplio espectro con acabado invisible, sin residuo blanco. Textura fluida que funciona como ultimo paso de la rutina de manana.',
    precio: '26.50',
    imagenUrl: null,
    disponible: true,
    presentacion: '50 ml',
  },
  {
    id: 'prod-balsamo-labial',
    nombre: 'Balsamo labial reparador',
    categoriaId: 'cat-proteccion',
    descripcion:
      'Cera de abeja y escualano para labios partidos. Sin sabor ni perfume, que es lo que invita a relamerse y termina resecando mas.',
    precio: '9.90',
    imagenUrl: null,
    disponible: false,
    presentacion: '15 ml',
  },
];
