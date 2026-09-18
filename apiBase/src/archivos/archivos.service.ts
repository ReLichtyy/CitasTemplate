import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Lo que acepta la caja de subida: JPG o PNG, hasta 4 MB. */
const TAMANO_MAX = 4 * 1024 * 1024;

/**
 * MIME -> extension que se guarda. La extension la fija el MIME detectado, no el nombre
 * del archivo que mando el cliente: un `malware.exe` renombrado a `.jpg` no pasa de aqui.
 */
const MIMES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);

/** Un nombre propio: 36 caracteres de UUID, punto, extension de las de arriba. */
const NOMBRE_PROPIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/;

/**
 * Almacen de las imagenes del catalogo.
 *
 * El disco y no la base: una imagen pedida por un `<img>` no pasa por ningun guard ni
 * sobre — no es una lectura de datos, es servir un archivo — y colgarla de la base le
 * regalaba a cada fila el peso de su foto. El nombre es un UUID del que no sale nada del
 * archivo original, y `rutaDe` solo responde a nombres con esa forma: el patron es el
 * guard, no el directorio.
 */
@Injectable()
export class ArchivosService {
  private readonly directorio: string;

  constructor(config: ConfigService) {
    // Relativo al cwd del proceso: en local es `apiBase/uploads`, en el VPS el que fije
    // el despliegue. Ver ARCHIVOS_DIR en `.env.example`.
    //
    // Se **resuelve** a absoluto aqui y no en cada uso: `sendFile` de express rechaza las
    // rutas relativas, y un `join` por peticion solo movia el problema un nivel.
    this.directorio = resolve(config.get<string>('ARCHIVOS_DIR') ?? 'uploads');
  }

  async guardar(archivo: Express.Multer.File): Promise<{ nombre: string }> {
    const extension = MIMES.get(archivo.mimetype);
    if (!extension) {
      throw new BadRequestException('La imagen debe ser JPG o PNG.');
    }
    // El tamano tambien lo corta multer (`limits.fileSize`); esto es el mismo techo con
    // nombre de campo, para que el mensaje sea el de la caja de subida y no el de multer.
    if (archivo.size > TAMANO_MAX) {
      throw new BadRequestException('La imagen no puede pasar de 4 MB.');
    }

    const nombre = `${randomUUID()}${extension}`;
    await mkdir(this.directorio, { recursive: true });
    await writeFile(resolve(this.directorio, nombre), archivo.buffer);
    return { nombre };
  }

  /** Ruta del archivo pedido, o 404 si no existe. `sendFile` hace el resto. */
  async rutaDe(nombre: string): Promise<string> {
    // Solo nombres con la forma de los que genera `guardar`: `/archivos/../.env` y
    // compania no casan con el patron y caen en el mismo 404 que un archivo inexistente,
    // que es la respuesta correcta — el guard no dice que exista.
    if (!NOMBRE_PROPIO.test(nombre)) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    const ruta = resolve(this.directorio, nombre);
    try {
      await access(ruta);
    } catch {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return ruta;
  }

  /**
   * Deshace una subida. El modal sube la imagen antes de guardar el recurso que la
   * referencia, y si ese guardado falla, la URL no la guarda nadie: dejar el archivo es
   * dejar un huerfano ocupando disco. Idempotente a proposito — que ya no exista es
   * exactamente lo que quien borra queria, no un error que tratar.
   */
  async eliminar(nombre: string): Promise<void> {
    if (!NOMBRE_PROPIO.test(nombre)) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    try {
      await unlink(resolve(this.directorio, nombre));
    } catch {
      // Ya no esta (o el directorio todavia no se creo): para un borrado es lo pedido.
    }
  }
}
