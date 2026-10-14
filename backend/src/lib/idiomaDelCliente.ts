import { prisma } from "./prisma.js";
import { errorMessage } from "./logUtils.js";
import { esCodigoDeIdioma, type CodigoDeIdioma } from "./idiomas/catalogo.js";
import { telefonoDelCliente, type TelefonosDelNegocio } from "./grabacion.js";

/**
 * El idioma en que habla cada cliente (decisión del usuario del 2026-10-13:
 * saludar a los clientes conocidos en su idioma). Lo dice el informe final
 * de la llamada (informar_al_negocio, `idioma_del_cliente`) y se guarda por
 * negocio y teléfono, como el permiso de grabar; el saludo de su próxima
 * llamada va en él (lib/contextoDeLlamada.ts) y el aviso de IA del chat
 * también. Siempre el de su última llamada: si cambia, cambia.
 *
 * Nunca lanza: el informe final no debe fallar por esto. Un fallo se dice
 * en el log con el negocio y la llamada.
 */
export async function guardarIdiomaDelCliente(input: {
  /** `Call.callId`: el call_control_id de Telnyx. */
  callId: string;
  businessId: string;
  idioma: unknown;
  etiqueta: string;
}): Promise<void> {
  if (input.idioma === undefined || input.idioma === null) return;
  if (!esCodigoDeIdioma(input.idioma)) {
    console.warn(
      `[Idioma] ${input.etiqueta}: el informe trae un idioma que no está en el catálogo («${String(input.idioma)}», negocio ${input.businessId}); no se guarda`
    );
    return;
  }
  try {
    const call = await prisma.call.findFirst({
      where: { callId: input.callId, businessId: input.businessId },
      select: {
        fromNumber: true,
        business: {
          select: {
            phone: true,
            telnyxPhoneNumber: true,
            ownerWhatsappNumber: true,
          },
        },
      },
    });
    const telefono = call
      ? telefonoDelCliente(call.fromNumber, call.business)
      : null;
    if (!telefono) return;
    const datos = { idioma: input.idioma, idiomaAt: new Date() };
    await prisma.clienteDelNegocio.upsert({
      where: {
        businessId_telefono: { businessId: input.businessId, telefono },
      },
      create: { businessId: input.businessId, telefono, ...datos },
      update: datos,
    });
  } catch (error) {
    console.error(
      `[Idioma] ${input.etiqueta}: no se pudo guardar el idioma ${input.idioma} del cliente (negocio ${input.businessId}): ${errorMessage(error)}`
    );
  }
}

/**
 * El idioma en que habló la última vez quien escribe, si la recepcionista
 * lo habla (`idiomas`, los del perfil del negocio); si no, null. Lo usa el
 * aviso de IA del chat (modules/whatsapp/chatCliente.ts); las llamadas lo
 * leen en lib/contextoDeLlamada.ts con el resto de la ficha.
 *
 * Nunca lanza: sin él se avisa en el principal. Un fallo se dice en el log.
 */
export async function idiomaGuardadoDelCliente(input: {
  businessId: string;
  telefono: string | null;
  negocio: TelefonosDelNegocio;
  idiomas: readonly CodigoDeIdioma[];
  etiqueta: string;
}): Promise<CodigoDeIdioma | null> {
  const telefono = telefonoDelCliente(input.telefono, input.negocio);
  if (!telefono) return null;
  try {
    const cliente = await prisma.clienteDelNegocio.findUnique({
      where: {
        businessId_telefono: { businessId: input.businessId, telefono },
      },
      select: { idioma: true },
    });
    const idioma = cliente?.idioma;
    return esCodigoDeIdioma(idioma) && input.idiomas.includes(idioma)
      ? idioma
      : null;
  } catch (error) {
    console.error(
      `[Idioma] ${input.etiqueta}: no se pudo leer el idioma del cliente (negocio ${input.businessId}); se usa el principal: ${errorMessage(error)}`
    );
    return null;
  }
}
