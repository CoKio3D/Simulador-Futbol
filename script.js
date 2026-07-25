/*****************************************************************
 * Calculadora de Presupuestos - CoKio3D
 * Versión 3.6 (Desglose con precios y Costes simplificados)
 *****************************************************************/

const PRECIO_PLA_KG = 20;       // 20 € / kg
const COSTE_IMPRESORA_HORA = 2; // 2 € / hora
const CONSUMO_ELECTRICO_HORA = 0.05; // Coste de luz por hora (€/h)
const COSTE_DISENO_HORA = 15;   // 15 € / hora
const COSTE_PREPARACION_HORA = 10;
const CLAVE_REGISTRO = "180506"; 

let ultimoPresupuesto = null;
let grafico = null;
let historial = JSON.parse(localStorage.getItem("historialCoKio3D")) || [];
let presupuestosGuardados = JSON.parse(localStorage.getItem("presupuestosGuardadosCoKio3D")) || [];
let registroTrabajos3D = JSON.parse(localStorage.getItem("registroTrabajos3D")) || [];
let historialTrabajos = registroTrabajos3D; 

let ordenActual = {
    columna: null,
    ascendente: true
};

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", iniciarAplicacion);

function iniciarAplicacion() {

    // Conecta el botón de calcular (no tiene onclick en el HTML)
    document.getElementById("btnCalcular")?.addEventListener("click", calcularPrecio);

    // Registra el Service Worker (antes se definía pero nunca se llamaba)
    registrarServiceWorker();

    // Fuerza la orientación horizontal en móviles cuando la app está instalada
    forzarOrientacionHorizontal();

    // Pinta la tabla de registro y el historial con los datos ya guardados
    renderizarTablaRegistro();
    mostrarHistorial();

    console.log("✅ CoKio3D iniciado correctamente");

}

function euros(valor) {
    return (valor || 0).toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " €";
}

function generarNumeroPresupuesto() {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    const hora = String(ahora.getHours()).padStart(2, "0");
    const minuto = String(ahora.getMinutes()).padStart(2, "0");
    return `${año}${mes}${dia}-${hora}${minuto}`;
}

function formatearHoras(horas) {
    const h = Math.floor(horas || 0);
    const m = Math.round(((horas || 0) - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function interpretarTiempo(texto) {
    if (!texto) return 0;
    texto = texto.toString().trim().toLowerCase().replace(",", ".");
    if (texto === "") return 0;

    let patronDosPuntos = /^(\d+):(\d{1,2})$/;
    let encontradoDosPuntos = texto.match(patronDosPuntos);
    if (encontradoDosPuntos) {
        return parseInt(encontradoDosPuntos[1], 10) + (parseInt(encontradoDosPuntos[2], 10) / 60);
    }

    if (!isNaN(texto)) return parseFloat(texto);

    let patron = /(\d+(\.\d+)?)h\s*(\d+)?m?/;
    let encontrado = texto.match(patron);
    if (encontrado) {
        return parseFloat(encontrado[1]) + (parseFloat(encontrado[3] || 0) / 60);
    }

    if (texto.endsWith("m")) return parseFloat(texto) / 60;
    if (texto.endsWith("h")) return parseFloat(texto);

    return 0;
}

function registrarServiceWorker() {
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./service-worker.js").catch(() => {});
        });
    }
}

function forzarOrientacionHorizontal() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
    }
}

/* =========================================================
   CÁLCULO Y PRESUPUESTOS
   ========================================================= */
function calcularPrecio() {
    const horasDiseno = interpretarTiempo(document.getElementById("tiempoDiseno")?.value || 0);
    const horasImpresion = interpretarTiempo(document.getElementById("tiempo")?.value || 0);
    const horasPreparacion = interpretarTiempo(document.getElementById("tiempoPreparacion")?.value || 0);
    const gramos = parseFloat(document.getElementById("filamento")?.value) || 0;

    const costeMaterial = (gramos / 1000) * PRECIO_PLA_KG;
    const costeImpresion = horasImpresion * COSTE_IMPRESORA_HORA;
    const costeLuz = horasImpresion * CONSUMO_ELECTRICO_HORA;
    const costeDiseno = horasDiseno * COSTE_DISENO_HORA;
    const costePreparacion = horasPreparacion * COSTE_PREPARACION_HORA;

    const total = costeMaterial + costeImpresion + costeDiseno + costePreparacion;
    const numeroPresupuesto = generarNumeroPresupuesto();

    const numPresElem = document.getElementById("numeroPresupuesto");
    const precFinElem = document.getElementById("precioFinal");
    if (numPresElem) numPresElem.textContent = numeroPresupuesto;
    if (precFinElem) precFinElem.textContent = euros(total);
    animarPrecio();

    const resElem = document.getElementById("resultado");
    if (resElem) {
        resElem.innerHTML = `
            <strong>Material (${gramos}g):</strong> ${euros(costeMaterial)}<br>
            <strong>Impresión (${formatearHoras(horasImpresion)}):</strong> ${euros(costeImpresion)}<br>
            <strong>Consumo Eléctrico:</strong> ${euros(costeLuz)}<br>
            <strong>Diseño (${formatearHoras(horasDiseno)}):</strong> ${euros(costeDiseno)}<br>
            <strong>Preparación (${formatearHoras(horasPreparacion)}):</strong> ${euros(costePreparacion)}<br>
            <hr style="margin: 8px 0; border:0; border-top:1px solid #ccc;">
            <h3>Total: ${euros(total)}</h3>
        `;
    }

    ultimoPresupuesto = {
        numero: numeroPresupuesto,
        fecha: new Date().toLocaleDateString("es-ES"),
        cliente: document.getElementById("cliente")?.value || "Cliente general",
        proyecto: document.getElementById("proyecto")?.value || "Pieza 3D",
        observaciones: document.getElementById("observaciones")?.value || "-",
        gramos,
        horasImpresion,
        horasDiseno,
        horasPreparacion,
        material: costeMaterial,
        impresion: costeImpresion,
        luz: costeLuz,
        diseno: costeDiseno,
        preparacion: costePreparacion,
        total
    };

    actualizarGrafico(costeMaterial, costeImpresion, costeDiseno, costePreparacion, gramos, horasImpresion, horasDiseno, horasPreparacion);

    guardarHistorial({
        fecha: new Date().toLocaleDateString("es-ES"),
        total,
        gramos,
        horas: horasImpresion
    });

    abrirModal("modalConfirmarGuardar");
}

function confirmarGuardado(guardar) {
    cerrarModal("modalConfirmarGuardar");
    
    if (guardar && ultimoPresupuesto) {
        presupuestosGuardados.unshift(ultimoPresupuesto);
        localStorage.setItem("presupuestosGuardadosCoKio3D", JSON.stringify(presupuestosGuardados));
        
        const hoy = new Date();
        const fechaISO = hoy.toISOString().split("T")[0];

        const costeFabricacion = (ultimoPresupuesto.material || 0) + (ultimoPresupuesto.impresion || 0);
        const precioVendido = ultimoPresupuesto.total || 0;
        const beneficioNeto = precioVendido - costeFabricacion;

        const nuevoTrabajoRegistro = {
            id: Date.now(),
            fecha: fechaISO,
            cliente: ultimoPresupuesto.cliente || "Sin nombre",
            producto: ultimoPresupuesto.proyecto || "Pieza 3D",
            gramos: ultimoPresupuesto.gramos || 0,
            horas: ultimoPresupuesto.horasImpresion || 0,
            horasDiseno: ultimoPresupuesto.horasDiseno || 0,
            horasPreparacion: ultimoPresupuesto.horasPreparacion || 0,
            horasImpresora: ultimoPresupuesto.horasImpresion || 0,
            costeMaterial: ultimoPresupuesto.material || 0,
            costeImpresora: ultimoPresupuesto.impresion || 0,
            costeLuz: ultimoPresupuesto.luz || 0,
            costeDiseno: ultimoPresupuesto.diseno || 0,
            costePreparacion: ultimoPresupuesto.preparacion || 0,
            coste: parseFloat(costeFabricacion.toFixed(2)),
            vendido: parseFloat(precioVendido.toFixed(2)),
            beneficio: parseFloat(beneficioNeto.toFixed(2)),
            observaciones: ultimoPresupuesto.observaciones || ""
        };

        registroTrabajos3D.unshift(nuevoTrabajoRegistro);
        localStorage.setItem("registroTrabajos3D", JSON.stringify(registroTrabajos3D));
        historialTrabajos = registroTrabajos3D;

        renderizarPresupuestosGuardados();
        renderizarTablaRegistro();

        alert("✅ Presupuesto guardado e integrado correctamente en el Registro.");
    }
}

/* =========================================================
   GRÁFICO
   ========================================================= */
function actualizarGrafico(material, impresion, diseno, preparacion, gramos, horasImpresion, horasDiseno, horasPreparacion) {
    const canvas = document.getElementById("graficoCostes");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const total = material + impresion + diseno + preparacion;
    if (grafico) grafico.destroy();

    const tiempoImpresionTexto = formatearHoras(horasImpresion || 0);
    const tiempoDisenoTexto = formatearHoras(horasDiseno || 0);
    const tiempoPrepTexto = formatearHoras(horasPreparacion || 0);

    const textoCentro = {
        id: "textoCentro",
        afterDraw(chart) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            if (!meta.data.length) return;

            const x = meta.data[0].x;
            const y = meta.data[0].y;

            ctx.save();
            ctx.textAlign = "center";
            ctx.fillStyle = "#263238";
            ctx.font = "bold 20px Arial";
            ctx.fillText(euros(total), x, y - 4);

            ctx.font = "12px Arial";
            ctx.fillStyle = "#777";
            ctx.fillText("TOTAL", x, y + 18);
            ctx.restore();
        }
    };

    grafico = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: [
                `Material (${gramos || 0}g)`, 
                `Impresión (${tiempoImpresionTexto})`, 
                `Diseño (${tiempoDisenoTexto})`, 
                `Preparación (${tiempoPrepTexto})`
            ],
            datasets: [{
                data: [material, impresion, diseno, preparacion],
                backgroundColor: ["#76B5E8", "#2A66B2", "#174A86", "#22A447"],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            cutout: "68%",
            animation: { duration: 400 },
            plugins: { 
                legend: { display: true, position: 'bottom' }
            }
        },
        plugins: [textoCentro]
    });
}

/* =========================================================
   PRESUPUESTOS GUARDADOS
   ========================================================= */

function renderizarTablaRegistro(lista = historialTrabajos) {
    const cuerpo = document.getElementById("cuerpoTablaRegistro");
    if (!cuerpo) return;

    cuerpo.innerHTML = "";

    let totalIngresos = 0;
    let totalGastos = 0;
    let totalBeneficio = 0;
    let totalGramos = 0;
    let totalHoras = 0;

    lista.forEach((item) => {
        totalIngresos += item.vendido || 0;
        totalGastos += item.coste || 0;
        totalBeneficio += item.beneficio || 0;
        totalGramos += item.gramos || 0;
        totalHoras += item.horas || 0;

        const costeMat = item.costeMaterial !== undefined ? item.costeMaterial : ((item.gramos / 1000) * PRECIO_PLA_KG);
        const costeImp = item.costeImpresora !== undefined ? item.costeImpresora : (item.horas * COSTE_IMPRESORA_HORA);
        const costeElectrico = item.costeLuz !== undefined ? item.costeLuz : (item.horas * CONSUMO_ELECTRICO_HORA);
        
        const costeFilamentoYLuz = costeMat + costeElectrico;
        const beneficioReal = (item.vendido || 0) - costeFilamentoYLuz;

        // Fila Principal (Resumen)
        const filaPrincipal = document.createElement("tr");
        filaPrincipal.className = "fila-principal";
        filaPrincipal.style.cursor = "pointer";
        filaPrincipal.setAttribute("onclick", `toggleDetalleRegistro(${item.id})`);
        
        filaPrincipal.innerHTML = `
            <td>${item.fecha || '-'}</td>
            <td><strong>${item.cliente || 'General'}</strong></td>
            <td>${item.producto}</td>
            <td class="${beneficioReal >= 0 ? 'texto-positivo' : 'texto-negativo'}">${euros(beneficioReal)}</td>
            <td style="text-align: center;"><span class="flecha-desplegable" id="flecha-${item.id}">▼</span></td>
        `;

        // Fila Detalle (Desplegable)
        const filaDetalle = document.createElement("tr");
        filaDetalle.className = "fila-detalle";
        filaDetalle.id = `detalle-${item.id}`;
        filaDetalle.style.display = "none";

        filaDetalle.innerHTML = `
            <td colspan="5" style="padding: 16px; background-color: #f8fafc; border-bottom: 2px solid var(--borde, #e2e8f0);">
                <div style="display: flex; flex-direction: column; gap: 14px;">
                    
                    <!-- BLOQUE 1: DESGLOSE CON PRECIOS + PRECIO VENDIDO -->
                    <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <span style="font-size: 12px; font-weight: bold; color: var(--azul, #2A66B2); display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Desglose del Trabajo</span>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; font-size: 13px;">
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">FILAMENTO</span>
                                <strong>${item.gramos} g (${euros(costeMat)})</strong>
                            </div>
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">HORAS IMPRESORA</span>
                                <strong>${formatearHoras(item.horas)} (${euros(costeImp)})</strong>
                            </div>
                            ${item.horasDiseno ? `
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">DISEÑO</span>
                                <strong>${formatearHoras(item.horasDiseno)} (${euros(item.costeDiseno)})</strong>
                            </div>` : ''}
                            ${item.horasPreparacion ? `
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">PREPARACIÓN</span>
                                <strong>${formatearHoras(item.horasPreparacion)} (${euros(item.costePreparacion)})</strong>
                            </div>` : ''}
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">PRECIO VENDIDO</span>
                                <strong style="color: #16a34a;">${euros(item.vendido)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- BLOQUE 2: COSTES Y BENEFICIO -->
                    <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <span style="font-size: 12px; font-weight: bold; color: var(--azul, #2A66B2); display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">💰 Costes y Beneficio</span>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; font-size: 13px;">
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">COSTE FILAMENTO</span>
                                <strong>${euros(costeMat)}</strong>
                            </div>
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">COSTE ELÉCTRICO</span>
                                <strong>${euros(costeElectrico)}</strong>
                            </div>
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">COSTE TOTAL</span>
                                <strong style="color: #dc2626;">${euros(costeFilamentoYLuz)}</strong>
                            </div>
                            <div>
                                <span style="color: #64748b; font-size: 11px; display: block; font-weight: bold;">BENEFICIO NETO</span>
                                <strong class="${beneficioReal >= 0 ? 'texto-positivo' : 'texto-negativo'}">${euros(beneficioReal)}</strong>
                            </div>
                        </div>
                    </div>

                    ${item.observaciones ? `
                        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
                            <span style="color: #64748b; font-size: 11px; font-weight: bold; display: block;">OBSERVACIONES:</span>
                            <span style="color: #334155; font-size: 13px;">${item.observaciones}</span>
                        </div>
                    ` : ''}

                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                    <button onclick="event.stopPropagation(); abrirModalEditar(${item.id});" style="background: var(--azul); color: white; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: bold; width: auto; margin: 0;">
                        ✏️ Editar Trabajo
                    </button>
                    <button onclick="event.stopPropagation(); eliminarTrabajoRegistro(${item.id});" style="background: #ef4444; color: white; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: bold; width: auto; margin: 0;">
                        🗑️ Eliminar Trabajo
                    </button>
                </div>
            </td>
        `;

        cuerpo.appendChild(filaPrincipal);
        cuerpo.appendChild(filaDetalle);
    });

    const mIng = document.getElementById("metricaIngresos");
    const mGas = document.getElementById("metricaGastos");
    const mBen = document.getElementById("metricaBeneficio");
    const mGra = document.getElementById("metricaGramos");
    const mHor = document.getElementById("metricaHoras");

    if (mIng) mIng.textContent = euros(totalIngresos);
    if (mGas) mGas.textContent = euros(totalGastos);
    if (mBen) mBen.textContent = euros(totalBeneficio);
    if (mGra) mGra.textContent = `${totalGramos.toFixed(1)} g`;
    if (mHor) mHor.textContent = `${totalHoras.toFixed(1)} h`;
}
   
function filtrarPresupuestosGuardados() {
    const textoBusqueda = document.getElementById("buscarCliente")?.value.toLowerCase() || "";
    const filtrados = presupuestosGuardados.filter(item =>
        item.cliente.toLowerCase().includes(textoBusqueda)
    );
    renderizarPresupuestosGuardados(filtrados);
}

function eliminarPresupuestoGuardado(index) {
    presupuestosGuardados.splice(index, 1);
    localStorage.setItem("presupuestosGuardadosCoKio3D", JSON.stringify(presupuestosGuardados));
    renderizarPresupuestosGuardados();
}

/* =========================================================
   MENÚ FLOTANTE Y MODALES
   ========================================================= */
function toggleFabMenu() {
    const menu = document.getElementById("fabMenu");
    if (menu) menu.classList.toggle("activo");
}

function abrirModal(idModal) {
    const mod = document.getElementById(idModal);
    if (mod) mod.classList.add("activo");
    const fab = document.getElementById("fabMenu");
    if (fab) fab.classList.remove("activo");
}

function cerrarModal(idModal) {
    const mod = document.getElementById(idModal);
    if (mod) mod.classList.remove("activo");
}

function cambiarPestana(pestana) {
    const btns = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");

    if (pestana === 'registro') {
        const claveIntroducida = prompt("🔒 Introduce la contraseña para acceder al Registro:");
        if (claveIntroducida !== CLAVE_REGISTRO) {
            alert("❌ Contraseña incorrecta. Acceso denegado.");
            return; 
        }
    }

    btns.forEach(btn => btn.classList.remove("active"));
    contents.forEach(content => content.classList.remove("active"));

    if (pestana === 'calculadora') {
        if (btns[0]) btns[0].classList.add("active");
        const calc = document.getElementById("vistaCalculadora");
        if (calc) calc.classList.add("active");
    } else {
        if (btns[1]) btns[1].classList.add("active");
        const reg = document.getElementById("vistaRegistro");
        if (reg) reg.classList.add("active");
        renderizarTablaRegistro();
    }
}

/* =========================================================
   REGISTRO DE TRABAJOS Y ACORDEÓN DESPLEGABLE
   ========================================================= */

function guardarNuevoTrabajo(e) {
    e.preventDefault();

    const fecha = document.getElementById("regFecha")?.value;
    const cliente = document.getElementById("regCliente")?.value || "General";
    const producto = document.getElementById("regProducto")?.value;
    const gramos = parseFloat(document.getElementById("regGramos")?.value) || 0;
    const horas = parseFloat(document.getElementById("regHoras")?.value) || 0;
    const vendido = parseFloat(document.getElementById("regVendido")?.value) || 0;
    const observaciones = document.getElementById("regObservaciones")?.value || "";

    const costeTotal = calcularCosteFabricacion(gramos, horas);
    const beneficio = vendido - costeTotal;

    const nuevoRegistro = { 
        id: Date.now(), 
        fecha, 
        cliente, 
        producto, 
        gramos, 
        horas, 
        costeMaterial: (gramos / 1000) * PRECIO_PLA_KG,
        costeImpresora: horas * COSTE_IMPRESORA_HORA,
        costeLuz: horas * CONSUMO_ELECTRICO_HORA,
        coste: costeTotal, 
        vendido, 
        beneficio: parseFloat(beneficio.toFixed(2)),
        observaciones
    };

    historialTrabajos.unshift(nuevoRegistro);
    localStorage.setItem("registroTrabajos3D", JSON.stringify(historialTrabajos));

    document.getElementById("formNuevoTrabajo")?.reset();
    const inputFecha = document.getElementById("regFecha");
    if (inputFecha) inputFecha.value = new Date().toISOString().split("T")[0];

    renderizarTablaRegistro();
}


function toggleDetalleRegistro(id) {
    const filaDetalle = document.getElementById(`detalle-${id}`);
    const flecha = document.getElementById(`flecha-${id}`);

    if (filaDetalle) {
        const estaOculta = filaDetalle.style.display === "none";
        filaDetalle.style.display = estaOculta ? "table-row" : "none";

        if (flecha) {
            flecha.style.transform = estaOculta ? "rotate(180deg)" : "rotate(0deg)";
        }
    }
}

function eliminarTrabajoRegistro(id) {
    if (confirm("¿Seguro que quieres borrar esta entrada del registro?")) {
        historialTrabajos = historialTrabajos.filter(t => t.id !== id);
        localStorage.setItem("registroTrabajos3D", JSON.stringify(historialTrabajos));
        renderizarTablaRegistro();
    }
}

function filtrarTrabajos() {
    const texto = document.getElementById("buscarTrabajo")?.value.toLowerCase() || "";
    const filtrados = historialTrabajos.filter(t => 
        (t.producto && t.producto.toLowerCase().includes(texto)) ||
        (t.cliente && t.cliente.toLowerCase().includes(texto))
    );
    renderizarTablaRegistro(filtrados);
}

function ordenarTablaRegistros(columna) {
    if (ordenActual.columna === columna) {
        ordenActual.ascendente = !ordenActual.ascendente;
    } else {
        ordenActual.columna = columna;
        ordenActual.ascendente = true;
    }

    historialTrabajos.sort((a, b) => {
        let valA = a[columna] ?? '';
        let valB = b[columna] ?? '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return ordenActual.ascendente ? -1 : 1;
        if (valA > valB) return ordenActual.ascendente ? 1 : -1;
        return 0;
    });

    const ths = document.querySelectorAll(".tabla-registro th.sortable");
    ths.forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");
    });

    const thActivo = document.getElementById(`th-${columna}`);
    if (thActivo) {
        thActivo.classList.add(ordenActual.ascendente ? "sort-asc" : "sort-desc");
    }

    renderizarTablaRegistro();
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function copiarPresupuesto() {
    if (!ultimoPresupuesto) {
        alert("Primero calcula un presupuesto.");
        return;
    }

    const texto = `🧾 PRESUPUESTO Nº ${ultimoPresupuesto.numero}
----------------------------------
Cliente: ${ultimoPresupuesto.cliente}
Proyecto: ${ultimoPresupuesto.proyecto}

• Material (${ultimoPresupuesto.gramos}g): ${euros(ultimoPresupuesto.material)}
• Impresión (${formatearHoras(ultimoPresupuesto.horasImpresion)}): ${euros(ultimoPresupuesto.impresion)}
• Consumo Eléctrico: ${euros(ultimoPresupuesto.luz)}
• Diseño (${formatearHoras(ultimoPresupuesto.horasDiseno)}): ${euros(ultimoPresupuesto.diseno)}
• Preparación (${formatearHoras(ultimoPresupuesto.horasPreparacion)}): ${euros(ultimoPresupuesto.preparacion)}
----------------------------------
💰 TOTAL: ${euros(ultimoPresupuesto.total)}`;

    navigator.clipboard.writeText(texto);
    alert("✅ Desglose copiado al portapapeles.");
}

function guardarHistorial(datos) {
    historial.unshift(datos);
    if (historial.length > 20) historial.pop();
    localStorage.setItem("historialCoKio3D", JSON.stringify(historial));
    mostrarHistorial();
}

function mostrarHistorial() {
    const contenedor = document.getElementById("historial");
    if (!contenedor) return;

    if (historial.length === 0) {
        contenedor.innerHTML = "<p>No hay presupuestos todavía.</p>";
        return;
    }

    contenedor.innerHTML = "";
    historial.forEach(item => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "historial-item";
        tarjeta.innerHTML = `
            <strong>${euros(item.total)}</strong><br>
            🖨 ${item.gramos} g | ⏱ ${item.horas.toFixed(2)} h<br>
            📅 ${item.fecha}
        `;
        contenedor.appendChild(tarjeta);
    });
}

function animarPrecio() {
    const precio = document.getElementById("precioFinal");
    if (precio) {
        precio.animate([
            { transform: "scale(0.95)" },
            { transform: "scale(1.05)" },
            { transform: "scale(1)" }
        ], { duration: 300 });
    }
}

function convertirADigital() {
    const val = document.getElementById("horasDecimales")?.value;
    const res = document.getElementById("horario");
    if (!res) return;
    if (!val || isNaN(val)) { res.innerHTML = "⚠️ N° no válido"; return; }
    const total = parseFloat(val);
    const h = Math.floor(total);
    const m = Math.round((total - h) * 60);
    res.innerHTML = `⏱️ <strong>Resultado:</strong> ${h}h ${m}m`;
}

function convertirADecimal() {
    const h = parseInt(document.getElementById("horas")?.value) || 0;
    const m = parseInt(document.getElementById("minutos")?.value) || 0;
    const res = document.getElementById("decimal");
    if (!res) return;
    if (!h && !m) { res.innerHTML = "⚠️ Introduce horas o mins."; return; }
    res.innerHTML = `⏱️ <strong>Resultado:</strong> ${(h + m/60).toFixed(2).replace(".", ",")} hrs`;
}

function calcularCosteFabricacion(gramos, horas) {
    const costeFilamento = (gramos / 1000) * PRECIO_PLA_KG;
    const costeImpresora = horas * CONSUMO_ELECTRICO_HORA; // o coste de luz
    return parseFloat((costeFilamento + costeImpresora).toFixed(2));
}

function abrirModalEditar(id) {
    const trabajo = historialTrabajos.find(t => t.id === id);
    if (!trabajo) return;

    document.getElementById("editId").value = trabajo.id;
    document.getElementById("editFecha").value = trabajo.fecha || '';
    document.getElementById("editCliente").value = trabajo.cliente || '';
    document.getElementById("editProducto").value = trabajo.producto || '';
    document.getElementById("editGramos").value = trabajo.gramos || 0;
    document.getElementById("editHoras").value = trabajo.horas || 0;
    document.getElementById("editVendido").value = trabajo.vendido || 0;
    document.getElementById("editObservaciones").value = trabajo.observaciones || '';

    abrirModal("modalEditarTrabajo");
}

function guardarEdicionTrabajo(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById("editId").value, 10);
    const index = historialTrabajos.findIndex(t => t.id === id);

    if (index !== -1) {
        const gramos = parseFloat(document.getElementById("editGramos").value) || 0;
        const horas = parseFloat(document.getElementById("editHoras").value) || 0;
        const vendido = parseFloat(document.getElementById("editVendido").value) || 0;

        const nuevoCoste = calcularCosteFabricacion(gramos, horas);
        const nuevoBeneficio = parseFloat((vendido - nuevoCoste).toFixed(2));

        historialTrabajos[index] = {
            ...historialTrabajos[index],
            fecha: document.getElementById("editFecha").value,
            cliente: document.getElementById("editCliente").value,
            producto: document.getElementById("editProducto").value,
            gramos: gramos,
            horas: horas,
            costeMaterial: (gramos / 1000) * PRECIO_PLA_KG,
            costeImpresora: horas * COSTE_IMPRESORA_HORA,
            costeLuz: horas * CONSUMO_ELECTRICO_HORA,
            coste: nuevoCoste,
            vendido: vendido,
            beneficio: nuevoBeneficio,
            observaciones: document.getElementById("editObservaciones").value
        };

        localStorage.setItem("registroTrabajos3D", JSON.stringify(historialTrabajos));
        renderizarTablaRegistro();
        cerrarModal("modalEditarTrabajo");
    }
}

function descargarRegistrosExcel() {
    if (typeof historialTrabajos === 'undefined' || historialTrabajos.length === 0) {
        alert("No hay registros disponibles para exportar.");
        return;
    }

    let contenidoXML = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Arial" ss:Size="10"/>
   <Interior/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2A66B2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Data">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="DataNumber">
   <Alignment ss:Horizontal="Right"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="10"/>
   <NumberFormat ss:Format="Standard"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Historial Proyectos">
  <Table>
   <Column ss:AutoFitWidth="1" ss:Width="90"/>
   <Column ss:AutoFitWidth="1" ss:Width="110"/>
   <Column ss:AutoFitWidth="1" ss:Width="140"/>
   <Column ss:AutoFitWidth="1" ss:Width="80"/>
   <Column ss:AutoFitWidth="1" ss:Width="90"/>
   <Column ss:AutoFitWidth="1" ss:Width="90"/>
   <Column ss:AutoFitWidth="1" ss:Width="90"/>
   <Column ss:AutoFitWidth="1" ss:Width="100"/>
   <Column ss:AutoFitWidth="1" ss:Width="150"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cliente</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Producto</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Gramos (g)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Horas Imp.</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Coste Total (€)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Precio Venta (€)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Beneficio (€)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Observaciones</Data></Cell>
   </Row>
`;

    historialTrabajos.forEach(item => {
        const costeMat = item.costeMaterial !== undefined ? item.costeMaterial : ((item.gramos / 1000) * (typeof PRECIO_PLA_KG !== 'undefined' ? PRECIO_PLA_KG : 20));
        const costeElectrico = item.costeLuz !== undefined ? item.costeLuz : (item.horas * (typeof CONSUMO_ELECTRICO_HORA !== 'undefined' ? CONSUMO_ELECTRICO_HORA : 0.5));
        const costeTotal = costeMat + costeElectrico + (item.costeDiseno || 0) + (item.costePreparacion || 0);
        const beneficio = (item.vendido || 0) - (costeMat + costeElectrico);

        contenidoXML += `   <Row>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${item.fecha || ''}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${item.cliente || 'General'}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${item.producto || ''}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${item.gramos || 0}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${item.horas || 0}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${costeTotal.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${(item.vendido || 0).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${beneficio.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="Data"><Data ss:Type="String">${item.observaciones || ''}</Data></Cell>
   </Row>\n`;
    });

    contenidoXML += `  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([contenidoXML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Historial_Proyectos_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function compartirPresupuesto() {
    // Verificamos si existe la variable global de cálculo
    if (typeof ultimoPresupuesto === 'undefined' || !ultimoPresupuesto) {
        alert("Primero calcula un presupuesto antes de compartirlo.");
        return;
    }

    // 1. Rellenar textos
    document.getElementById("facNumero").textContent = `Nº: ${ultimoPresupuesto.numero}`;
    document.getElementById("facFecha").textContent = `Fecha: ${ultimoPresupuesto.fecha}`;
    document.getElementById("facCliente").textContent = ultimoPresupuesto.cliente || "-";
    document.getElementById("facProyecto").textContent = ultimoPresupuesto.proyecto || "-";
    
    const obsBox = document.getElementById("facObsBox");
    const obsTexto = document.getElementById("facObservaciones");
    if (ultimoPresupuesto.observaciones && ultimoPresupuesto.observaciones !== "-") {
        obsBox.style.display = "block";
        obsTexto.textContent = ultimoPresupuesto.observaciones;
    } else {
        obsBox.style.display = "none";
    }

    // 2. Rellenar tabla
    const cuerpoFac = document.getElementById("facCuerpoTabla");
    cuerpoFac.innerHTML = `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 13px;"><strong>Material (Filamento 3D)</strong></td>
            <td style="padding: 10px; font-size: 13px;">${ultimoPresupuesto.gramos} g</td>
            <td style="padding: 10px; font-size: 13px; text-align: right;">${euros(ultimoPresupuesto.material)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 13px;"><strong>Impresión 3D / Electricidad</strong></td>
            <td style="padding: 10px; font-size: 13px;">${formatearHoras(ultimoPresupuesto.horasImpresion)}</td>
            <td style="padding: 10px; font-size: 13px; text-align: right;">${euros(ultimoPresupuesto.impresion + ultimoPresupuesto.luz)}</td>
        </tr>
        ${ultimoPresupuesto.horasDiseno > 0 ? `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 13px;"><strong>Tiempo de Diseño 3D</strong></td>
            <td style="padding: 10px; font-size: 13px;">${formatearHoras(ultimoPresupuesto.horasDiseno)}</td>
            <td style="padding: 10px; font-size: 13px; text-align: right;">${euros(ultimoPresupuesto.diseno)}</td>
        </tr>` : ''}
        ${ultimoPresupuesto.horasPreparacion > 0 ? `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 13px;"><strong>Preparación y Puesta a Punto</strong></td>
            <td style="padding: 10px; font-size: 13px;">${formatearHoras(ultimoPresupuesto.horasPreparacion)}</td>
            <td style="padding: 10px; font-size: 13px; text-align: right;">${euros(ultimoPresupuesto.preparacion)}</td>
        </tr>` : ''}
    `;

    document.getElementById("facTotalFinal").textContent = euros(ultimoPresupuesto.total);

    // 3. Hacer visible el contenedor de forma oculta en pantalla para que html2canvas lo lea bien
    const contenedorPlantilla = document.getElementById("plantillaFacturaContainer");
    contenedorPlantilla.style.display = "block";

    // 4. Generar el mini gráfico dentro de la plantilla
    const canvasFacturaEl = document.getElementById("graficoFacturaCanvas");
    let chartFacturaTemp = null;
    
    if (canvasFacturaEl && typeof Chart !== 'undefined') {
        const ctxFac = canvasFacturaEl.getContext("2d");
        const textoCentroFactura = {
            id: "textoCentroFactura",
            afterDraw(chart) {
                const { ctx, chartArea: { left, right, top, bottom } } = chart;
                const centroX = (left + right) / 2;
                const centroY = (top + bottom) / 2;
                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#1e293b";
                ctx.font = "bold 20px Arial";
                ctx.fillText(euros(ultimoPresupuesto.total), centroX, centroY - 9);
                ctx.fillStyle = "#94a3b8";
                ctx.font = "11px Arial";
                ctx.fillText("TOTAL", centroX, centroY + 13);
                ctx.restore();
            }
        };

        const componentesGrafico = [
            { label: "Material", valor: ultimoPresupuesto.material, color: "#76B5E8" },
            { label: "Impresión", valor: ultimoPresupuesto.impresion + ultimoPresupuesto.luz, color: "#2A66B2" },
            { label: "Diseño", valor: ultimoPresupuesto.diseno, color: "#174A86" },
            { label: "Preparación", valor: ultimoPresupuesto.preparacion, color: "#22A447" }
        ].filter(c => c.valor > 0);

        chartFacturaTemp = new Chart(ctxFac, {
            type: "doughnut",
            data: {
                labels: componentesGrafico.map(c => c.label),
                datasets: [{
                    data: componentesGrafico.map(c => c.valor),
                    backgroundColor: componentesGrafico.map(c => c.color),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: false,
                animation: false,
                cutout: "68%",
                plugins: { legend: { display: false } }
            },
            plugins: [textoCentroFactura]
        });

        const leyendaEl = document.getElementById("facLeyendaPorcentajes");
        if (leyendaEl) {
            leyendaEl.innerHTML = componentesGrafico.map(c => {
                const porcentaje = ultimoPresupuesto.total > 0 ? Math.round((c.valor / ultimoPresupuesto.total) * 100) : 0;
                return `<div><span class="color" style="background:${c.color}"></span>${c.label} <strong>${porcentaje}%</strong></div>`;
            }).join("");
        }
    }

    try {
        // Breve pausa para asegurar renderizado de fuentes y gráfico
        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = await html2canvas(document.getElementById("facturaImagen"), { 
            scale: 2,
            useCORS: true,
            logging: false
        });

        // Limpieza posterior
        if (chartFacturaTemp) chartFacturaTemp.destroy();
        contenedorPlantilla.style.display = "none";

        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert("❌ No se pudo crear la imagen del presupuesto.");
                return;
            }

            const archivo = new File([blob], `Presupuesto_${ultimoPresupuesto.numero}.png`, { type: "image/png" });
            
            if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
                try {
                    await navigator.share({
                        title: `Presupuesto ${ultimoPresupuesto.numero}`,
                        text: `Presupuesto para ${ultimoPresupuesto.cliente} - ${ultimoPresupuesto.proyecto}`,
                        files: [archivo]
                    });
                } catch (error) {
                    if (error.name !== "AbortError") {
                        console.log("Compartir cancelado", error);
                    }
                }
            } else {
                const enlace = document.createElement("a");
                enlace.href = URL.createObjectURL(blob);
                enlace.download = `Presupuesto_${ultimoPresupuesto.numero}.png`;
                enlace.click();
                alert("📥 Imagen del presupuesto descargada correctamente.");
            }
        }, "image/png");

    } catch (error) {
        if (chartFacturaTemp) chartFacturaTemp.destroy();
        contenedorPlantilla.style.display = "none";
        console.error("Error al generar la imagen:", error);
        alert("❌ Hubo un error al generar la imagen del presupuesto.");
    }
}
