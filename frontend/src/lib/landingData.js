/** Datos editables de la landing de presentación (Variante C · Galería). */

export const CONTACTO = {
  whatsapp: '5219992925021',
  whatsappVisible: '999 292 5021',
  mensajeWhatsapp: 'Hola ECA, me gustaría información para mi evento.',
  instagram: 'https://www.instagram.com/eca_mid/',
  facebook: 'https://www.facebook.com/profile.php?id=61576846621433',
  descargas: '/#eventos',
}

export const PAQUETES = [
  {
    grupo: 'Cabina de fotos',
    nombre: 'Standard',
    duracion: '2 horas',
    texto:
      'Impresiones ilimitadas al instante, plantilla personalizada a la temática de tu evento y accesorios para tus invitados.',
  },
  {
    grupo: 'Cabina de fotos',
    nombre: 'Plus',
    duracion: '2 horas',
    texto:
      'Todo lo de Standard, más recuerdos magnéticos, álbum digital y un video conmemorativo de tu evento.',
  },
  {
    grupo: 'Cabina de fotos',
    nombre: 'Pro',
    duracion: '2 horas',
    texto:
      'Todo lo de Standard, más un álbum físico de dedicatorias con fotos y mensajes de tus invitados.',
  },
  {
    grupo: 'Plataforma 360',
    nombre: 'Plata',
    duracion: '2 horas',
    texto: 'Videos 4K ilimitados con cámara lenta, efectos y descarga al instante durante el evento.',
  },
  {
    grupo: 'Plataforma 360',
    nombre: 'Gold',
    duracion: '2 horas',
    texto: 'Todo lo de Plata, más cabina inflable Deluxe con luces RGB y alfombra roja.',
  },
  {
    grupo: 'Plataforma 360',
    nombre: 'Platinum',
    duracion: '2 horas',
    texto: 'Todo lo de Gold, más equipo de sonido, animación con micrófono y botarga.',
  },
  {
    grupo: 'Experiencia completa',
    nombre: 'Estelar',
    duracion: '2 h 30 min',
    texto:
      'Cabina de fotos y Plataforma 360 funcionando al mismo tiempo, con sonido, animación y álbum digital de cortesía.',
  },
]

export const EVENTOS_MUESTRA = [
  { titulo: 'XV años', lugar: 'Mérida', servicio: 'Cabina de fotos', foto: '', muestra: true },
  { titulo: 'Boda en hacienda', lugar: 'Yucatán', servicio: 'Plataforma 360', foto: '', muestra: true },
  { titulo: 'Graduación', lugar: 'Mérida', servicio: 'Experiencia Estelar', foto: '', muestra: true },
  { titulo: 'Evento de empresa', lugar: 'Mérida', servicio: 'Cabina de fotos', foto: '', muestra: true },
  { titulo: 'Cumpleaños', lugar: 'Progreso', servicio: 'Plataforma 360', foto: '', muestra: true },
  { titulo: 'Posada', lugar: 'Mérida', servicio: 'Cabina de fotos', foto: '', muestra: true },
]

export const BLOG_IDEAS = [
  {
    titulo: 'Cabina de fotos o Plataforma 360: ¿cuál va con tu evento?',
    resumen:
      'La cabina entrega fotos impresas al momento; la 360 crea videos en cámara lenta para compartir. Te contamos cómo elegir según lo que quieres que se lleven tus invitados.',
    fecha: '',
    foto: '',
  },
  {
    titulo: 'Qué espacio necesitas para la Plataforma 360',
    resumen:
      'Un área de 3 × 3 metros, 2.5 metros de altura libre y piso firme, sin césped. Así lo dejamos todo listo y seguro.',
    fecha: '',
    foto: '',
  },
  {
    titulo: 'Así personalizamos la plantilla de tus fotos',
    resumen:
      'Adaptamos el diseño a la temática y los colores de tu evento, y lo apruebas antes de la fiesta.',
    fecha: '',
    foto: '',
  },
]

export function waUrl(texto) {
  const msg = texto || CONTACTO.mensajeWhatsapp
  return `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(msg)}`
}
