import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ErrorDeMulterFilter } from './error-de-multer.filter.js';
import { ArchivosService } from './archivos.service.js';

/** El techo de la caja de subida: JPG o PNG, hasta 4 MB. El mismo texto del formulario. */
const TAMANO_MAX = 4 * 1024 * 1024;

/**
 * Imagenes del catalogo: subirlas es del personal (ADMIN escribe el catalogo, EMPLEADO
 * agrega fotos de resultados a la galeria), leerlas es publico — un `<img>` no lleva
 * token y la foto de un servicio ya sale en el catalogo publico.
 */
@Controller('archivos')
@UseFilters(ErrorDeMulterFilter)
export class ArchivosController {
  constructor(private readonly service: ArchivosService) {}

  /**
   * Devuelve la URL **absoluta** de lo subido, construida con el host de la peticion: en
   * local apunta al API y en el VPS al dominio publico (nginx manda `Host` y
   * `X-Forwarded-Proto`, y `trust proxy` esta activo en main.ts). Es lo que se guarda en
   * `imagenUrl`/`fotoUrl`, y quien lo guarda no tiene que saber de origenes.
   */
  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      // En memoria y no en disco: el archivo se valida **antes** de existir. Un archivo
      // rechazado por MIME o tamano nunca llega a tocar el directorio publico.
      storage: memoryStorage(),
      limits: { fileSize: TAMANO_MAX },
    }),
  )
  async subir(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!archivo) {
      throw new BadRequestException('La imagen es obligatoria.');
    }
    const { nombre } = await this.service.guardar(archivo);
    return { url: `${req.protocol}://${req.get('host')}/archivos/${nombre}` };
  }

  /**
   * Sirve el archivo. `@Res` y no un return: un binario no pasa por el sobre — envolverlo
   * en JSON romperia al `<img>` que lo pide — y express ya sabe el `Content-Type` por la
   * extension. `sendFile` manda ETag y acepta rangos: la cache del navegador hace el resto.
   */
  @Public()
  @Get(':nombre')
  async ver(@Param('nombre') nombre: string, @Res() res: Response) {
    res.sendFile(await this.service.rutaDe(nombre));
  }

  /**
   * Deshace una subida: el frontend sube la imagen recien al guardar el recurso que la
   * referencia, y si ese guardado falla (un 409, una caida), esta es la que evita que la
   * URL sin dueno quede ocupando disco. Del personal, igual que subirla. 204 tanto si el
   * archivo estaba como si ya se habia ido: borrar dos veces lo mismo no es un error.
   */
  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Delete(':nombre')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('nombre') nombre: string) {
    await this.service.eliminar(nombre);
  }
}
