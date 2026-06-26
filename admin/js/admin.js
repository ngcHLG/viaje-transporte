// Autenticación real con Supabase Auth

async function verificarSesion() {
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error || !session) {
        if (!window.location.href.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }
}

async function iniciarSesion(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert('Error al iniciar sesión: ' + error.message);
    } else {
        // Sesión iniciada correctamente
        localStorage.setItem('adminSesion', 'activa'); // Mantenemos por compatibilidad
        window.location.href = 'dashboard.html';
    }
}

async function cerrarSesion() {
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) {
        alert('Error al cerrar sesión: ' + error.message);
    }
    localStorage.removeItem('adminSesion');
    localStorage.removeItem('adminTema'); // Opcional: limpiar tema
    window.location.href = 'index.html';
}

// Carga la barra superior y el sidebar
function cargarEstructuraAdmin() {
    // Barra superior fija
    const topBar = document.createElement('div');
    topBar.className = 'top-bar';
    topBar.innerHTML = `
        <button class="btn-toggle-sidebar" id="toggleSidebar">
            <i class="bi bi-list"></i>
        </button>
        <span class="brand"><i class="bi bi-bus-front-fill me-2"></i>Viajes Transporte</span>
        <button class="btn btn-outline-secondary btn-sm rounded-pill" id="btnModoOscuro" title="Cambiar modo">
            <i class="bi bi-moon-stars"></i>
        </button>
    `;
    document.body.prepend(topBar);

    // Sidebar
    const sidebarHtml = `
        <div class="sidebar p-3" id="sidebar">
            <h5 class="fw-bold mb-4"><i class="bi bi-speedometer2 me-2"></i>Menú</h5>
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a href="dashboard.html" class="nav-link" id="nav-dashboard">
                        <i class="bi bi-speedometer2 me-2"></i>Dashboard
                    </a>
                </li>
                <li class="nav-item">
                    <a href="reservas.html" class="nav-link" id="nav-reservas">
                        <i class="bi bi-journal-text me-2"></i>Reservas
                    </a>
                </li>
                <li class="nav-item">
                    <a href="flota.html" class="nav-link" id="nav-flota">
                        <i class="bi bi-truck me-2"></i>Flota
                    </a>
                </li>
                <li class="nav-item">
                    <a href="tarifas.html" class="nav-link" id="nav-tarifas">
                        <i class="bi bi-cash-coin me-2"></i>Tarifas
                    </a>
                </li>
                <li class="nav-item">
                    <a href="puntos.html" class="nav-link" id="nav-puntos">
                        <i class="bi bi-geo-alt me-2"></i>Puntos
                    </a>
                </li>
                <li class="nav-item">
                    <a href="configuracion.html" class="nav-link" id="nav-configuracion">
                        <i class="bi bi-sliders me-2"></i>Configuración
                    </a>
                </li>
                <li class="nav-item">
                    <a href="reportes.html" class="nav-link" id="nav-reportes">
                        <i class="bi bi-bar-chart me-2"></i>Reportes
                    </a>
                </li>
            </ul>
            <hr>
            <button class="btn btn-outline-secondary btn-sm w-100" onclick="cerrarSesion()">
                <i class="bi bi-box-arrow-right me-1"></i>Cerrar sesión
            </button>
        </div>
    `;
    document.getElementById('sidebarContainer').innerHTML = sidebarHtml;

    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('toggleSidebar');

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function updateToggleIcon() {
        const abierto = (isMobile() && sidebar.classList.contains('show')) ||
                         (!isMobile() && !sidebar.classList.contains('collapsed'));
        toggleBtn.innerHTML = abierto ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';
    }

    function aplicarEstadoInicial() {
        if (isMobile()) {
            sidebar.classList.remove('collapsed');
            main.classList.remove('expanded');
        } else {
            sidebar.classList.remove('show');
            sidebar.classList.remove('collapsed');
            main.classList.remove('expanded');
        }
        updateToggleIcon();
    }

    window.addEventListener('resize', aplicarEstadoInicial);

    toggleBtn.addEventListener('click', () => {
        if (isMobile()) {
            sidebar.classList.toggle('show');
        } else {
            sidebar.classList.toggle('collapsed');
            main.classList.toggle('expanded');
        }
        updateToggleIcon();
    });

    aplicarEstadoInicial();

    // Resaltar enlace activo
    const paginaActual = window.location.pathname.split('/').pop();
    const navId = `nav-${paginaActual.replace('.html', '')}`;
    const link = document.getElementById(navId);
    if (link) link.classList.add('active');
}

// Modo oscuro unificado (con persistencia en localStorage)
function inicializarModoOscuro() {
    const btn = document.getElementById('btnModoOscuro');
    if (!btn) return;
    const html = document.documentElement;

    function aplicarTema(tema) {
        html.setAttribute('data-bs-theme', tema);
        localStorage.setItem('adminTema', tema);
        btn.innerHTML = tema === 'dark'
            ? '<i class="bi bi-sun-fill"></i>'
            : '<i class="bi bi-moon-stars"></i>';
    }

    const temaGuardado = localStorage.getItem('adminTema');
    if (temaGuardado) {
        aplicarTema(temaGuardado);
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        aplicarTema(prefersDark ? 'dark' : 'light');
    }

    btn.addEventListener('click', () => {
        const nuevoTema = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        aplicarTema(nuevoTema);
    });
}

// Al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSesion();
    if (document.getElementById('sidebarContainer')) {
        cargarEstructuraAdmin();
        inicializarModoOscuro();
    }
});