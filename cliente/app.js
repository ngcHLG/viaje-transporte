(function() {
    // ---- Estado de la aplicación ----
    const state = {
        fecha: null,
        origen: '',
        destino: '',
        viajesDisponibles: [],
        viajeSeleccionado: null,
        asientosSeleccionados: [],
        numPasajeros: 1,
        codigoSolicitud: '',
        datosPasajeros: {}
    };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const modalMensaje = new bootstrap.Modal(document.getElementById('modalMensaje'));
    const modalMisViajes = new bootstrap.Modal(document.getElementById('modalMisViajes'));

    function mostrarMensaje(titulo, mensaje) {
        document.getElementById('modalMensajeTitulo').textContent = titulo;
        document.getElementById('modalMensajeCuerpo').textContent = mensaje;
        modalMensaje.show();
    }

    // ---- Datos desde Supabase ----
    let puntosRecogida = {};
    let tarifas = {};
    let provinciasAbrev = {};

    async function cargarProvincias() {
        const { data, error } = await window.supabaseClient.from('provincias').select('id, abreviatura');
        if (error) { console.error('Error al cargar provincias:', error); return; }
        provinciasAbrev = {};
        data.forEach(p => { provinciasAbrev[p.id] = p.abreviatura; });
    }

    async function cargarPuntos() {
        const { data, error } = await window.supabaseClient.from('puntos').select('*');
        if (error) { console.error('Error al cargar puntos:', error); return; }
        puntosRecogida = {};
        data.forEach(p => {
            puntosRecogida[p.id] = {
                img: p.imagen_url,
                direccion: p.direccion,
                provincia_id: p.provincia_id
            };
        });

        const origenSelect = document.getElementById('selectOrigen');
        const destinoSelect = document.getElementById('selectDestino');
        [origenSelect, destinoSelect].forEach(select => {
            select.innerHTML = '<option value="">Selecciona...</option>';
            data.forEach(p => {
                const nombre = p.nombre || p.id;
                select.innerHTML += `<option value="${p.id}">${nombre}</option>`;
            });
        });
    }

    async function cargarTarifas() {
        const { data, error } = await window.supabaseClient
            .from('tarifas')
            .select('origen_id, destino_id, precio_ida, activa');
        if (error) { console.error('Error al cargar tarifas:', error); return; }
        tarifas = {};
        data.filter(t => t.activa).forEach(t => {
            const key = `${t.origen_id}-${t.destino_id}`;
            tarifas[key] = { ida: t.precio_ida };
        });
    }

    function generarCodigoSolicitud(origenId, destinoId) {
        const ahora = new Date();
        const aa = String(ahora.getFullYear()).slice(-2);
        const mm = String(ahora.getMonth() + 1).padStart(2, '0');
        const dd = String(ahora.getDate()).padStart(2, '0');
        const hh = String(ahora.getHours()).padStart(2, '0');
        const min = String(ahora.getMinutes()).padStart(2, '0');
        const ss = String(ahora.getSeconds()).padStart(2, '0');

        const provOrigen = puntosRecogida[origenId]?.provincia_id;
        const provDestino = puntosRecogida[destinoId]?.provincia_id;
        const abrevOrigen = provOrigen ? (provinciasAbrev[provOrigen] || provOrigen.toUpperCase().substring(0,3)) : '???';
        const abrevDestino = provDestino ? (provinciasAbrev[provDestino] || provDestino.toUpperCase().substring(0,3)) : '???';

        return `${abrevOrigen}-${abrevDestino}-${aa}-${mm}-${dd}-${hh}${min}${ss}`;
    }

    // ---- Funciones de UI ----
    function actualizarIndicadorPasos(pasoActivo) {
        $$('.step-dot').forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            if (index + 1 < pasoActivo) dot.classList.add('completed');
            if (index + 1 === pasoActivo) dot.classList.add('active');
        });
    }

    function mostrarPaso(paso) {
        $$('.step-content').forEach(el => el.classList.add('d-none'));
        const pasoActual = document.getElementById(`step${paso}`);
        if (pasoActual) pasoActual.classList.remove('d-none');
        actualizarIndicadorPasos(paso);
        const footer = document.getElementById('footerResumen');
        if (paso === 3 && state.viajeSeleccionado && state.asientosSeleccionados.length > 0) {
            footer.classList.remove('d-none');
        } else {
            footer.classList.add('d-none');
        }
    }

    function mostrarExito(codigo, enlaceMagico) {
        $$('.step-content').forEach(el => el.classList.add('d-none'));
        document.getElementById('stepSuccess').classList.remove('d-none');
        document.getElementById('codigoSolicitud').textContent = codigo;
        const enlaceContainer = document.getElementById('enlaceMagicoContainer');
        if (enlaceMagico) {
            enlaceContainer.classList.remove('d-none');
            document.getElementById('enlaceMagicoURL').textContent = enlaceMagico;
            document.getElementById('enlaceMagicoLink').href = enlaceMagico;
        } else {
            enlaceContainer.classList.add('d-none');
        }
        document.getElementById('footerResumen').classList.add('d-none');
        if (window.deferredPrompt) document.getElementById('btnInstalarPWA').style.display = 'block';
        if ('Notification' in window && Notification.permission === 'default') {
            document.getElementById('btnActivarNotif').style.display = 'block';
        }
    }

    // ---- Paso 1: Fecha ----
    const fechaInput = document.getElementById('fechaViaje');
    const btnBuscarFecha = document.getElementById('btnBuscarFecha');
    const fechaSinViajes = document.getElementById('fechaSinViajes');

    fechaInput.addEventListener('change', () => {
        state.fecha = fechaInput.value;
        btnBuscarFecha.disabled = !state.fecha;
        fechaSinViajes.classList.add('d-none');
    });

    btnBuscarFecha.addEventListener('click', async () => {
        if (!state.fecha) return;
        const { data, error } = await window.supabaseClient
            .from('vehiculos')
            .select('id')
            .eq('fecha_salida', state.fecha)
            .limit(1);
        if (error) {
            console.error('Error al verificar fecha:', error);
            mostrarMensaje('Error', 'No se pudo verificar la disponibilidad. Intenta de nuevo.');
            return;
        }
        if (!data || data.length === 0) {
            fechaSinViajes.classList.remove('d-none');
            return;
        }
        fechaSinViajes.classList.add('d-none');
        mostrarPaso(2);
    });

    // ---- Paso 2: Origen/Destino ----
    const selectOrigen = document.getElementById('selectOrigen');
    const selectDestino = document.getElementById('selectDestino');
    const imagenOrigenContainer = document.getElementById('imagenOrigenContainer');
    const imagenDestinoContainer = document.getElementById('imagenDestinoContainer');
    const imagenOrigen = document.getElementById('imagenOrigen');
    const imagenDestino = document.getElementById('imagenDestino');
    const direccionOrigen = document.getElementById('direccionOrigen');
    const direccionDestino = document.getElementById('direccionDestino');
    const precioReferenciaContainer = document.getElementById('precioReferenciaContainer');
    const precioReferenciaTexto = document.getElementById('precioReferenciaTexto');
    const btnConfirmarRuta = document.getElementById('btnConfirmarRuta');

    function actualizarImagenPunto(tipo) {
        const select = tipo === 'origen' ? selectOrigen : selectDestino;
        const container = tipo === 'origen' ? imagenOrigenContainer : imagenDestinoContainer;
        const img = tipo === 'origen' ? imagenOrigen : imagenDestino;
        const dir = tipo === 'origen' ? direccionOrigen : direccionDestino;
        const valor = select.value;
        if (valor && puntosRecogida[valor]) {
            img.src = puntosRecogida[valor].img;
            dir.textContent = puntosRecogida[valor].direccion;
            container.classList.remove('d-none');
        } else {
            container.classList.add('d-none');
        }
    }

    function actualizarPrecioReferencia() {
        const origen = selectOrigen.value;
        const destino = selectDestino.value;
        if (origen && destino && origen !== destino) {
            const rutaKey = `${origen}-${destino}`;
            if (tarifas[rutaKey]) {
                const precio = tarifas[rutaKey].ida;
                state.viajesDisponibles.forEach(v => v.precio = precio);
                precioReferenciaTexto.textContent = `${precio.toLocaleString()} CUP (ida)`;
                precioReferenciaContainer.classList.remove('d-none');
            } else {
                precioReferenciaContainer.classList.add('d-none');
            }
        } else {
            precioReferenciaContainer.classList.add('d-none');
        }
    }

    function verificarBotonConfirmarRuta() {
        if (state.origen && state.destino && state.origen !== state.destino) {
            btnConfirmarRuta.classList.remove('d-none');
            btnConfirmarRuta.disabled = false;
        } else {
            btnConfirmarRuta.classList.add('d-none');
            btnConfirmarRuta.disabled = true;
        }
    }

    selectOrigen.addEventListener('change', () => {
        state.origen = selectOrigen.value;
        actualizarImagenPunto('origen');
        actualizarPrecioReferencia();
        if (state.origen && state.destino && state.origen === state.destino) {
            selectDestino.value = '';
            state.destino = '';
            imagenDestinoContainer.classList.add('d-none');
            precioReferenciaContainer.classList.add('d-none');
        }
        verificarBotonConfirmarRuta();
    });

    selectDestino.addEventListener('change', () => {
        state.destino = selectDestino.value;
        actualizarImagenPunto('destino');
        actualizarPrecioReferencia();
        verificarBotonConfirmarRuta();
    });

    btnConfirmarRuta.addEventListener('click', async () => {
        if (state.origen && state.destino && state.origen !== state.destino) {
            await cargarViajesDisponibles();
            mostrarPaso(3);
        }
    });

    document.getElementById('btnVolverPaso1').addEventListener('click', () => mostrarPaso(1));

    // ---- Paso 3: Viajes y asientos (con carga real de ocupación) ----
    async function cargarViajesDisponibles() {
        const { data: vehiculos, error } = await window.supabaseClient
            .from('vehiculos')
            .select('id, tipo, placa, capacidad, estado, chofer_id, fecha_salida, hora_salida, choferes(nombre, licencia)')
            .eq('fecha_salida', state.fecha)
            .eq('origen_id', state.origen)
            .eq('destino_id', state.destino);

        if (error) {
            console.error('Error al cargar viajes:', error);
            state.viajesDisponibles = [];
            renderizarListaViajes();
            return;
        }

        if (!vehiculos || vehiculos.length === 0) {
            state.viajesDisponibles = [];
            renderizarListaViajes();
            return;
        }

        const idsVehiculos = vehiculos.map(v => v.id);
        const { data: solicitudes, error: errorSolicitudes } = await window.supabaseClient
            .from('solicitudes')
            .select('id, estado, vehiculo_id')
            .in('vehiculo_id', idsVehiculos)
            .eq('fecha_viaje', state.fecha)
            .in('estado', ['pendiente', 'confirmada']);

        if (errorSolicitudes) {
            console.error('Error al cargar solicitudes:', errorSolicitudes);
            state.viajesDisponibles = [];
            renderizarListaViajes();
            return;
        }

        const idsSolicitudes = solicitudes.map(s => s.id);
        let pasajeros = [];
        if (idsSolicitudes.length > 0) {
            const { data: pasData, error: errorPasajeros } = await window.supabaseClient
                .from('pasajeros')
                .select('solicitud_id, numero_asiento')
                .in('solicitud_id', idsSolicitudes);
            if (!errorPasajeros) {
                pasajeros = pasData;
            }
        }

        const asientosPorVehiculo = {};
        idsVehiculos.forEach(id => {
            asientosPorVehiculo[id] = { pendientes: [], ocupados: [] };
        });

        solicitudes.forEach(s => {
            const pasajerosDeSolicitud = pasajeros.filter(p => p.solicitud_id === s.id);
            pasajerosDeSolicitud.forEach(p => {
                if (s.estado === 'confirmada') {
                    asientosPorVehiculo[s.vehiculo_id].ocupados.push(p.numero_asiento);
                } else if (s.estado === 'pendiente') {
                    asientosPorVehiculo[s.vehiculo_id].pendientes.push(p.numero_asiento);
                }
            });
        });

        state.viajesDisponibles = vehiculos.map(v => ({
            id: v.id,
            tipo: v.tipo,
            placa: v.placa,
            capacidad: v.capacidad,
            estado: v.estado,
            chofer: v.choferes ? `${v.choferes.nombre} (Lic. ${v.choferes.licencia})` : 'Sin asignar',
            fecha_salida: v.fecha_salida,
            hora_salida: v.hora_salida,
            asientosOcupados: asientosPorVehiculo[v.id]?.ocupados || [],
            asientosSolicitados: asientosPorVehiculo[v.id]?.pendientes || [],
            precio: 0
        }));

        actualizarPrecioReferencia();
        renderizarListaViajes();
    }

    function getAsientosLibres(vehiculo) {
        const total = vehiculo.capacidad || 41;
        const ocupados = vehiculo.asientosOcupados.length;
        const solicitados = vehiculo.asientosSolicitados.length;
        return total - ocupados - solicitados;
    }

    function renderizarListaViajes() {
        const container = document.getElementById('listaViajes');
        const sinViajes = document.getElementById('sinViajesDisponibles');
        const asientosCard = document.getElementById('asientosCard');

        asientosCard.classList.add('d-none');
        state.viajeSeleccionado = null;
        state.asientosSeleccionados = [];
        document.getElementById('footerResumen').classList.add('d-none');

        if (state.viajesDisponibles.length === 0) {
            container.innerHTML = '';
            sinViajes.classList.remove('d-none');
            return;
        }
        sinViajes.classList.add('d-none');
        container.innerHTML = state.viajesDisponibles.map((vehiculo, index) => {
            const libres = getAsientosLibres(vehiculo);
            return `
            <div class="col-12">
                <div class="card viaje-card p-3" data-vehiculo-index="${index}">
                    <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center">
                        <div class="info-vehiculo">
                            <h6 class="mb-1"><i class="bi bi-bus-front me-2"></i>${vehiculo.tipo}</h6>
                            <p class="mb-0 small text-secondary">
                                <i class="bi bi-upc-scan me-1"></i>${vehiculo.placa} &nbsp;
                                <i class="bi bi-person-badge me-1"></i>${vehiculo.chofer}
                            </p>
                            <p class="mb-0 small text-secondary">
                                <i class="bi bi-clock me-1"></i>Salida: ${vehiculo.hora_salida || '08:00 AM'}
                            </p>
                        </div>
                        <div class="mt-2 mt-sm-0 text-sm-end">
                            <span class="badge bg-success-subtle text-success fs-6">
                                <i class="bi bi-person-check me-1"></i>${libres} libres
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        container.querySelectorAll('.viaje-card').forEach(card => {
            card.addEventListener('click', function() {
                const index = parseInt(this.dataset.vehiculoIndex);
                seleccionarVehiculo(index);
            });
        });
    }

    function seleccionarVehiculo(index) {
        state.viajeSeleccionado = { ...state.viajesDisponibles[index] };
        state.asientosSeleccionados = [];
        state.numPasajeros = 1;
        document.getElementById('numPasajeros').value = 1;
        document.getElementById('numPasajeros').max = getAsientosLibres(state.viajeSeleccionado);
        document.getElementById('asientosCard').classList.remove('d-none');
        generarAsientos();
        actualizarFooterResumen();
        document.getElementById('footerResumen').classList.add('d-none');
    }

    function generarAsientos() {
        const busLayout = document.getElementById('busLayout');
        if (!state.viajeSeleccionado) return;

        const capacidad = state.viajeSeleccionado.capacidad || 41;
        let html = '<div class="d-flex flex-column align-items-center">';

        html += `
            <div class="d-flex align-items-start mb-3 w-100" style="max-width: 250px;">
                <div class="d-flex flex-column align-items-center me-auto">
                    <button class="bus-seat conductor mb-1" disabled>
                        <i class="bi bi-person-workspace"></i>
                    </button>
                    <small class="text-secondary">Conductor</small>
                </div>
            </div>
        `;

        const filasCompletas = Math.floor(capacidad / 4);
        const asientosRestantes = capacidad % 4;

        for (let fila = 0; fila < filasCompletas; fila++) {
            const base = fila * 4 + 1;
            const a = base, b = base + 1, c = base + 2, d = base + 3;
            html += '<div class="d-flex align-items-center mb-1">';
            html += `<button class="bus-seat me-1" data-seat="${a}" onclick="window.seatClick('${a}')">${a}</button>`;
            html += `<button class="bus-seat me-2" data-seat="${b}" onclick="window.seatClick('${b}')">${b}</button>`;
            html += '<div class="bus-aisle"></div>';
            html += `<button class="bus-seat ms-2" data-seat="${c}" onclick="window.seatClick('${c}')">${c}</button>`;
            html += `<button class="bus-seat ms-1" data-seat="${d}" onclick="window.seatClick('${d}')">${d}</button>`;
            html += '</div>';
        }

        if (asientosRestantes > 0) {
            html += '<div class="d-flex justify-content-center align-items-center mb-1 mt-2">';
            const inicio = filasCompletas * 4 + 1;
            for (let i = 0; i < asientosRestantes; i++) {
                const num = inicio + i;
                html += `<button class="bus-seat me-1" data-seat="${num}" onclick="window.seatClick('${num}')">${num}</button>`;
            }
            html += '</div>';
        }

        html += '</div>';
        busLayout.innerHTML = html;
        actualizarEstadoAsientos();
    }

    window.seatClick = function(seatId) {
        if (!state.viajeSeleccionado) return;
        const seatStr = String(seatId);
        if (state.viajeSeleccionado.asientosOcupados.includes(seatStr)) return;
        const idx = state.asientosSeleccionados.indexOf(seatStr);
        if (idx > -1) {
            state.asientosSeleccionados.splice(idx, 1);
        } else {
            if (state.asientosSeleccionados.length < state.numPasajeros) {
                state.asientosSeleccionados.push(seatStr);
            } else {
                state.asientosSeleccionados.shift();
                state.asientosSeleccionados.push(seatStr);
            }
        }
        actualizarEstadoAsientos();
        actualizarFooterResumen();
    };

    function actualizarEstadoAsientos() {
        const botones = document.querySelectorAll('.bus-seat:not(.conductor)');
        botones.forEach(btn => {
            const seat = btn.dataset.seat;
            btn.classList.remove('selected', 'occupied', 'pending');
            if (state.viajeSeleccionado) {
                if (state.viajeSeleccionado.asientosOcupados.includes(seat)) {
                    btn.classList.add('occupied');
                    btn.disabled = true;
                } else if (state.viajeSeleccionado.asientosSolicitados.includes(seat)) {
                    btn.classList.add('pending');
                    btn.disabled = false;
                } else {
                    btn.disabled = false;
                }
                if (state.asientosSeleccionados.includes(seat)) {
                    btn.classList.add('selected');
                }
            }
        });
        const resumen = document.getElementById('resumenSeleccion');
        if (state.asientosSeleccionados.length > 0) {
            resumen.classList.remove('d-none');
            document.getElementById('asientosSeleccionadosTexto').textContent =
                `Asientos: ${state.asientosSeleccionados.join(', ')}`;
            document.getElementById('totalPagar').textContent =
                `${(state.asientosSeleccionados.length * state.viajeSeleccionado.precio).toLocaleString()} CUP`;
        } else {
            resumen.classList.add('d-none');
        }
    }

    function actualizarFooterResumen() {
        const footer = document.getElementById('footerResumen');
        const footerAsientos = document.getElementById('footerAsientos');
        const footerPrecio = document.getElementById('footerPrecio');
        if (state.viajeSeleccionado && state.asientosSeleccionados.length > 0) {
            footerAsientos.textContent = `${state.asientosSeleccionados.length} asiento(s)`;
            footerPrecio.textContent =
                `${(state.asientosSeleccionados.length * state.viajeSeleccionado.precio).toLocaleString()} CUP`;
            footer.classList.remove('d-none');
        } else {
            footer.classList.add('d-none');
        }
    }

    document.getElementById('btnMenosPasajeros').addEventListener('click', () => {
        if (state.numPasajeros > 1) {
            state.numPasajeros--;
            document.getElementById('numPasajeros').value = state.numPasajeros;
            state.asientosSeleccionados = state.asientosSeleccionados.slice(0, state.numPasajeros);
            actualizarEstadoAsientos();
            actualizarFooterResumen();
        }
    });

    document.getElementById('btnMasPasajeros').addEventListener('click', () => {
        const max = state.viajeSeleccionado ? getAsientosLibres(state.viajeSeleccionado) : 1;
        if (state.numPasajeros < max) {
            state.numPasajeros++;
            document.getElementById('numPasajeros').value = state.numPasajeros;
            actualizarFooterResumen();
        }
    });

    document.getElementById('btnIrResumen').addEventListener('click', () => {
        if (!state.viajeSeleccionado) return;
        if (state.asientosSeleccionados.length === state.numPasajeros) {
            prepararResumen();
            mostrarPaso(4);
        } else {
            mostrarMensaje('Atención',
                `Debes seleccionar exactamente ${state.numPasajeros} asiento(s). Tienes ${state.asientosSeleccionados.length}.`
            );
        }
    });

    document.getElementById('btnVolverPaso2').addEventListener('click', () => mostrarPaso(2));

    // ---- Paso 4: Resumen y envío a Supabase ----
    function prepararResumen() {
        const resumenDiv = document.getElementById('resumenFinal');
        const viaje = state.viajeSeleccionado;
        const total = state.asientosSeleccionados.length * viaje.precio;
        resumenDiv.innerHTML = `
            <p><i class="bi bi-calendar3 me-2"></i><strong>Fecha:</strong> ${state.fecha}</p>
            <p><i class="bi bi-geo-alt me-2"></i><strong>Ruta:</strong> ${selectOrigen.options[selectOrigen.selectedIndex].text} → ${selectDestino.options[selectDestino.selectedIndex].text}</p>
            <p><i class="bi bi-clock me-2"></i><strong>Salida:</strong> ${viaje.hora_salida || '08:00 AM'}</p>
            <p><i class="bi bi-bus-front me-2"></i><strong>Ómnibus:</strong> ${viaje.tipo} (${viaje.placa})</p>
            <p><i class="bi bi-person-badge me-2"></i><strong>Chófer:</strong> ${viaje.chofer}</p>
            <p><i class="bi bi-person-check me-2"></i><strong>Asientos:</strong> ${state.asientosSeleccionados.join(', ')}</p>
            <p class="fw-bold fs-5"><i class="bi bi-cash-coin me-2"></i>Total: ${total.toLocaleString()} CUP</p>
        `;

        const container = document.getElementById('pasajerosContainer');
        container.innerHTML = '';
        state.asientosSeleccionados.forEach(asiento => {
            const div = document.createElement('div');
            div.className = 'border rounded p-3 mb-3';
            div.innerHTML = `
                <h6 class="fw-semibold mb-2"><i class="bi bi-person-badge me-2"></i>Asiento ${asiento}</h6>
                <div class="mb-2">
                    <label class="form-label">Nombre y apellidos</label>
                    <input type="text" class="form-control pasajero-nombre" data-asiento="${asiento}" required>
                    <div class="invalid-feedback">Ingresa el nombre completo.</div>
                </div>
                <div class="mb-2">
                    <label class="form-label">Carnet de Identidad</label>
                    <input type="text" class="form-control pasajero-carnet" data-asiento="${asiento}" required>
                    <div class="invalid-feedback">Ingresa el carnet de identidad.</div>
                </div>
            `;
            container.appendChild(div);
        });
    }

    const nombreInput = document.getElementById('nombreCliente');
    const emailInput = document.getElementById('emailCliente');
    const telefonoInput = document.getElementById('telefonoCliente');
    const formCliente = document.getElementById('formCliente');

    function validarCampo(input) {
        if (input.checkValidity()) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
        }
    }

    nombreInput.addEventListener('input', () => validarCampo(nombreInput));
    emailInput.addEventListener('input', () => validarCampo(emailInput));
    telefonoInput.addEventListener('input', () => validarCampo(telefonoInput));

    formCliente.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!formCliente.checkValidity()) {
            e.stopPropagation();
            formCliente.classList.add('was-validated');
            mostrarMensaje('Formulario incompleto', 'Por favor completa todos los campos del solicitante.');
            return;
        }

        const nombreInputs = document.querySelectorAll('.pasajero-nombre');
        const carnetInputs = document.querySelectorAll('.pasajero-carnet');
        let pasajerosValidos = true;
        const pasajerosData = {};

        nombreInputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                pasajerosValidos = false;
            } else {
                input.classList.remove('is-invalid');
                const asiento = input.dataset.asiento;
                pasajerosData[asiento] = { nombre: input.value.trim() };
            }
        });

        carnetInputs.forEach(input => {
            const asiento = input.dataset.asiento;
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                pasajerosValidos = false;
            } else {
                input.classList.remove('is-invalid');
                if (pasajerosData[asiento]) {
                    pasajerosData[asiento].carnet = input.value.trim();
                }
            }
        });

        if (!pasajerosValidos) {
            mostrarMensaje('Datos incompletos', 'Todos los pasajeros deben tener nombre y carnet de identidad.');
            return;
        }

        state.datosPasajeros = pasajerosData;

        try {
            const vehiculo = state.viajeSeleccionado;
            const codigo = generarCodigoSolicitud(state.origen, state.destino);

            const { error: errorSolicitud } = await window.supabaseClient.from('solicitudes').insert({
                id: codigo,
                fecha_viaje: state.fecha,
                origen_id: state.origen,
                destino_id: state.destino,
                vehiculo_id: vehiculo.id,
                estado: 'pendiente',
                datos_cliente: {
                    nombre: nombreInput.value.trim(),
                    email: emailInput.value.trim(),
                    telefono: telefonoInput.value.trim()
                },
                historial: [{
                    estado: 'pendiente',
                    fecha: new Date().toISOString(),
                    usuario: 'cliente'
                }]
            });
            if (errorSolicitud) throw errorSolicitud;

            const pasajerosInserts = Object.entries(state.datosPasajeros).map(([asiento, datos]) => ({
                solicitud_id: codigo,
                numero_asiento: asiento,
                nombre: datos.nombre,
                carnet: datos.carnet
            }));

            const { error: errorPasajeros } = await window.supabaseClient.from('pasajeros').insert(pasajerosInserts);
            if (errorPasajeros) throw errorPasajeros;

            // ---- CREAR ENLACE MÁGICO ----
            const token = crypto.randomUUID();
            const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const emailCliente = emailInput.value.trim();

            const { error: errorToken } = await window.supabaseClient.from('magic_links').insert({
                email: emailCliente,
                token: token,
                solicitud_id: codigo,
                expira_en: expira
            });
            if (errorToken) {
                console.warn('No se pudo crear el enlace mágico:', errorToken);
            }

            const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
            const enlaceMagico = `${baseUrl}consulta.html?token=${token}`;

            state.codigoSolicitud = codigo;
            mostrarExito(codigo, enlaceMagico);
        } catch (error) {
            console.error('Error al guardar la solicitud:', error);
            mostrarMensaje('Error', 'No se pudo enviar la solicitud. Por favor intenta de nuevo.');
        }
    });

    document.getElementById('btnVolverPaso3').addEventListener('click', () => mostrarPaso(3));
    document.getElementById('btnNuevaSolicitud').addEventListener('click', resetearApp);

    function resetearApp() {
        state.fecha = null;
        state.origen = '';
        state.destino = '';
        state.viajesDisponibles = [];
        state.viajeSeleccionado = null;
        state.asientosSeleccionados = [];
        state.numPasajeros = 1;
        state.codigoSolicitud = '';
        state.datosPasajeros = {};
        fechaInput.value = '';
        selectOrigen.value = '';
        selectDestino.value = '';
        imagenOrigenContainer.classList.add('d-none');
        imagenDestinoContainer.classList.add('d-none');
        precioReferenciaContainer.classList.add('d-none');
        btnConfirmarRuta.classList.add('d-none');
        btnConfirmarRuta.disabled = true;
        document.getElementById('footerResumen').classList.add('d-none');
        document.getElementById('formCliente').reset();
        document.getElementById('formCliente').classList.remove('was-validated');
        $$('.is-valid, .is-invalid').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
        document.getElementById('pasajerosContainer').innerHTML = '';
        mostrarPaso(1);
    }

    // ---- Modo oscuro ----
    const btnModoOscuro = document.getElementById('btnModoOscuro');
    const htmlElement = document.documentElement;

    function actualizarIconoModo() {
        if (htmlElement.getAttribute('data-bs-theme') === 'dark') {
            btnModoOscuro.innerHTML = '<i class="bi bi-sun-fill"></i>';
        } else {
            btnModoOscuro.innerHTML = '<i class="bi bi-moon-stars"></i>';
        }
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        htmlElement.setAttribute('data-bs-theme', 'dark');
    }
    actualizarIconoModo();

    btnModoOscuro.addEventListener('click', () => {
        if (htmlElement.getAttribute('data-bs-theme') === 'dark') {
            htmlElement.setAttribute('data-bs-theme', 'light');
        } else {
            htmlElement.setAttribute('data-bs-theme', 'dark');
        }
        actualizarIconoModo();
    });

    // ---- PWA y notificaciones ----
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        document.getElementById('btnInstalarPWA').style.display = 'block';
        document.getElementById('btnInstalarPWA').addEventListener('click', () => {
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then(() => {
                window.deferredPrompt = null;
                document.getElementById('btnInstalarPWA').style.display = 'none';
            });
        });
    });

    document.getElementById('btnActivarNotif').addEventListener('click', () => {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    mostrarMensaje('Notificaciones activadas',
                        'Te avisaremos cuando tu viaje esté confirmado.');
                    document.getElementById('btnActivarNotif').style.display = 'none';
                }
            });
        }
    });

    // ---- Modal "Mis viajes" (recuperar enlace mágico por código de solicitud) ----
    document.getElementById('btnMisViajes').addEventListener('click', () => {
        document.getElementById('codigoMisViajes').value = '';
        document.getElementById('enlaceRecuperadoContainer').classList.add('d-none');
        document.getElementById('errorCodigoMisViajes').style.display = 'none';
        modalMisViajes.show();
    });

    document.getElementById('btnBuscarEnlace').addEventListener('click', async () => {
        const codigo = document.getElementById('codigoMisViajes').value.trim();
        const errorDiv = document.getElementById('errorCodigoMisViajes');
        const enlaceContainer = document.getElementById('enlaceRecuperadoContainer');

        if (!codigo) {
            errorDiv.style.display = 'block';
            return;
        }

        // Buscar un enlace activo no usado
        let { data, error } = await window.supabaseClient
            .from('magic_links')
            .select('token')
            .eq('solicitud_id', codigo)
            .eq('usado', false)
            .order('creado_en', { ascending: false })
            .limit(1);

        if (error) {
            errorDiv.style.display = 'block';
            enlaceContainer.classList.add('d-none');
            return;
        }

        // Si no hay enlace activo, generar uno nuevo
        if (!data || data.length === 0) {
            const { data: solicitud, error: solError } = await window.supabaseClient
                .from('solicitudes')
                .select('datos_cliente')
                .eq('id', codigo)
                .maybeSingle();

            if (solError || !solicitud) {
                errorDiv.style.display = 'block';
                enlaceContainer.classList.add('d-none');
                return;
            }

            const token = crypto.randomUUID();
            const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const email = solicitud.datos_cliente?.email || '';

            const { error: insertError } = await window.supabaseClient.from('magic_links').insert({
                email: email,
                token: token,
                solicitud_id: codigo,
                expira_en: expira
            });

            if (insertError) {
                errorDiv.style.display = 'block';
                enlaceContainer.classList.add('d-none');
                return;
            }

            data = [{ token }];
        }

        errorDiv.style.display = 'none';

        const token = data[0].token;
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        const enlace = `${baseUrl}consulta.html?token=${token}`;

        document.getElementById('enlaceRecuperadoInput').value = enlace;
        document.getElementById('enlaceRecuperadoLink').href = enlace;
        enlaceContainer.classList.remove('d-none');

        document.getElementById('btnCopiarEnlace').addEventListener('click', () => {
            navigator.clipboard.writeText(enlace).then(() => {
                alert('Enlace copiado al portapapeles.');
            });
        });
    });

    // ---- Botón Ayuda ----
    document.getElementById('btnAyuda').addEventListener('click', () => {
        mostrarMensaje('Contacto',
            'Teléfono: +53 5XXX XXXX\nEmail: info@viajestransporte.cu');
    });

    // Inicializar todo
    (async function init() {
        await Promise.all([cargarProvincias(), cargarPuntos(), cargarTarifas()]);
        mostrarPaso(1);
    })();
})();