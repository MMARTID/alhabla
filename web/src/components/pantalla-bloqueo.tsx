import { relato, type GuionRelato } from "@/lib/relato-guiones";
import styles from "./pantalla-bloqueo.module.css";

/**
 * La pantalla de bloqueo del portátil, en el relevo de «En tu bolsillo» a
 * «En tu negocio» (ver `lib/transicion-bolsillo-negocio.ts`): es el negro
 * en el que se zambulle el teléfono y del que sale la cámara, y mientras se
 * aleja aparecen en él la hora (la del teléfono, dos minutos después) y lo
 * que de verdad le llega al dueño de la cita nueva: el aviso de WhatsApp de
 * Alhabla, con su texto real y sus dos botones (`relato().avisos`). Luego la
 * pantalla se desbloquea y en el panel está esa cita.
 *
 * Vive dentro de la pantalla HTML del portátil (`.mx`), proyectada sobre la
 * tapa 3D, así que se ve nítida a cualquier distancia. Todo se mide en `--u`
 * (1/1200 del ancho de la pantalla). Lo que aparece y cuándo lo pone
 * `pintarBloqueo` (lib/pantalla-bloqueo.ts) con los `data-bloqueo` de cada
 * pieza; empiezan invisibles. (Hasta el 2026-10-22 se pintaba dos veces: la
 * otra copia iba en un rectángulo negro de «En tu bolsillo».)
 */
export function PantallaBloqueo({ guion }: { guion: GuionRelato }) {
  const { avisos } = relato(guion);
  return (
    <div className={styles.bloqueo} aria-hidden="true">
      <div className={styles.contenido}>
        <div className={styles.reloj} data-bloqueo="reloj">
          <p className={styles.fecha}>Miércoles, 30 de septiembre</p>
          <p className={styles.hora}>17:04</p>
        </div>
        <ul className={styles.avisos}>
          {avisos.map((aviso, i) => (
            <li
              key={aviso.titulo}
              className={styles.aviso}
              data-bloqueo={`aviso-${i}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- isotipo local */}
              <img
                src="/brand/alhabla-isotipo.svg"
                alt=""
                className={styles.icono}
              />
              <div className={styles.cuerpo}>
                <p className={styles.app}>
                  <span>{aviso.app}</span>
                  <span>{aviso.hace}</span>
                </p>
                <p className={styles.cabecera}>
                  <b>{aviso.titulo}</b>
                </p>
                <p className={styles.texto}>{aviso.texto}</p>
                <div className={styles.botones}>
                  {aviso.botones.map((boton) => (
                    <span key={boton}>{boton}</span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
