// Formas de dominio del catalogo publico, en un solo lugar. Hoy las llenan los
// placeholders de EquipoPage; manana, el contrato de los endpoints publicos de solo
// lectura (spec 03). Las cards consumen estos tipos en vez de props sueltas: agregar un
// campo deja de obligar a tocar la pagina y las dos cards.

export type Resena = {
  id: string;
  autor: string;
  puntuacion: number;
  comentario: string;
  /** ISO solo-fecha: "2026-08-14". Ver lib/formatFecha. */
  fecha: string;
};

export type Rating = {
  promedio: number;
  total: number;
  /** El servidor las devuelve ya ordenadas por fecha desc y recortadas. */
  ultimasResenas: Resena[];
};

export type Especialista = {
  id: string;
  nombre: string;
  apellido: string | null;
  especialidad: string | null;
  fotoUrl: string | null;
  bio: string | null;
  /** Null mientras no tenga resenas: la card no pinta el boton de rating. */
  rating: Rating | null;
};

export type Servicio = {
  id: string;
  nombre: string;
  duracionMinutos: number;
  /** Decimal en la base, cadena en el JSON. No se convierte a number: ver lib/formatPrice. */
  precio: string;
  imagenUrl: string | null;
  descripcion: string | null;
};
