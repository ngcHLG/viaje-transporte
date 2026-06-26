// Datos que debe suministrar el backend al panel de administración.
// Estos arrays y objetos deben ser llenados por las APIs correspondientes
// antes de que el panel pueda mostrar información real.

// Flota de vehículos: cada vehículo debe contener al menos:
// id, tipo, placa, chofer, capacidad, asientosOcupados[], asientosSolicitados[]
const flotaVehiculos = [];

// Tarifas: objeto cuyas claves son cadenas "origen-destino" y valor { ida, vuelta }
const tarifas = {};

// Puntos de recogida/llegada: clave = id de ciudad, valor { img (URL), direccion }
const puntosRecogida = {};

// Reservas: array de objetos con la siguiente estructura (ejemplo):
// {
//   id: string,
//   fecha: 'YYYY-MM-DD',
//   origen: string,
//   destino: string,
//   cliente: { nombre, email, telefono },
//   pasajeros: { "numeroAsiento": { nombre, carnet } },
//   vehiculoId: string,
//   chofer: string,
//   estado: 'pendiente' | 'confirmada' | 'en_transito' | 'completada' | 'cancelada',
//   fechaCreacion: ISO string,
//   historial: [ { estado, fecha, usuario } ]
// }
let reservas = [];