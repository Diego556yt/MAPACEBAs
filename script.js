const map = L.map('map').setView([-9.19, -75.015], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let cebasData = [];
let userLocation = null;

// -------------------------
// 🔔 Mostrar mensajes visuales
// -------------------------
function mostrarEstado(texto, color = '#d63333') {
  const estado = document.getElementById('estadoBusqueda');
  estado.innerText = texto;
  estado.style.color = color;
}

// -------------------------
// 🧭 Geolocaliza una dirección
// -------------------------
async function geolocalizar(nombre, distrito) {
  const nombreLimpio = nombre.replace(/^CEBA\s*/i, '').trim();
  const query = `${nombreLimpio}, ${distrito}, Perú`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

  console.log(`🧭 [Paso 4] Geolocalizando: "${query}"...`);
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
      console.log(`✅ [Paso 4] Coordenadas encontradas para: "${nombre}"`);
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    } else {
      console.warn(`⚠️ [Paso 4] No se encontraron coordenadas para: "${nombre}"`);
      return null;
    }
  } catch (error) {
    console.error(`❌ [Paso 4] Error al consultar Nominatim para: "${query}"`, error);
    return null;
  }
}

// -------------------------
// 📏 Calcula distancia (sin usar por ahora)
// -------------------------
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// -------------------------
// 🚀 Cargar CSV desde Google Sheets
// -------------------------
console.log("🟡 [Paso 1] Iniciando carga de datos desde Google Sheets...");

fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSQADDmts-FWnd3fIM6oLrPVonUMFsyMGojDJjj6Ke3DLqJuU8EvEEzMA1WLXuV4G3KJ4mUDnM-LD5A/pub?output=csv')
  .then(res => res.text())
  .then(csv => {
    const rows = csv.trim().split('\n').slice(1);
    cebasData = [];

    rows.forEach((row, index) => {
      const columnas = row.split(',');
      if (columnas.length >= 2) {
        const nombre = columnas[0]?.trim();
        const distrito = columnas[1]?.trim().toLowerCase();
        if (nombre && distrito) {
          cebasData.push({ nombre, distrito });
        } else {
          console.warn(`⚠️ [Fila ${index + 2}] Datos incompletos. Se omitió.`);
        }
      } else {
        console.warn(`⚠️ [Fila ${index + 2}] Fila malformada: "${row}". Se omitió.`);
      }
    });

    console.log(`✅ [Paso 1] ${cebasData.length} CEBAs cargados desde el CSV.`);
  })
  .catch(error => {
    console.error("❌ [Paso 1] Error al cargar los datos del CSV:", error);
  });

// -------------------------
// 🔍 Buscar por distrito
// -------------------------
async function buscarPorDistrito() {
  mostrarEstado("⏳ Buscando CEBAs en el distrito...");
  console.log("🔵 [Paso 2] Iniciando proceso de búsqueda...");

  const input = document.getElementById("districtInput").value.trim().toLowerCase();
  if (!input) {
    console.warn("⚠️ [Paso 2] No se ingresó ningún distrito.");
    mostrarEstado("⚠️ Por favor, ingresa un distrito.");
    return;
  }

  console.log(`📥 [Paso 2] Input de distrito recibido: "${input}"`);

  if (cebasData.length === 0) {
    console.warn("⚠️ [Paso 2] La base de datos aún no está cargada.");
    mostrarEstado("⚠️ La base de datos aún no está cargada.");
    return;
  }

  console.log("🔍 [Paso 3] Buscando coincidencias en base de datos...");
  const encontrados = cebasData.filter(c => c.distrito.includes(input));
  console.log(`📊 [Paso 3] CEBAs encontrados en el distrito "${input}": ${encontrados.length}`);

  // Limpiar marcadores anteriores (excepto "Estás aquí")
  map.eachLayer(layer => {
    if (layer instanceof L.Marker && !layer._popup._content.includes("Estás aquí")) {
      map.removeLayer(layer);
    }
  });

  if (encontrados.length === 0) {
    console.warn("⚠️ [Paso 3] No se encontraron CEBAs para ese distrito.");
    mostrarEstado("⚠️ No se encontraron CEBAs para ese distrito.");
    return;
  }

  console.log("🧭 [Paso 4] Iniciando proceso de geolocalización de coincidencias...");

  let primeraUbicacion = null;
  let geolocalizados = 0;

  for (const ceba of encontrados) {
    const coords = await geolocalizar(ceba.nombre, ceba.distrito);
    if (coords) {
      const marker = L.marker([coords.lat, coords.lng])
        .addTo(map)
        .bindPopup(`<b>${ceba.nombre}</b><br>${ceba.distrito}`);
      if (!primeraUbicacion) primeraUbicacion = coords;
      geolocalizados++;
    }
    await new Promise(res => setTimeout(res, 1000)); // Evitar bloqueo
  }

  if (primeraUbicacion) {
    map.setView([primeraUbicacion.lat, primeraUbicacion.lng], 13);
    console.log(`✅ [Paso 5] ${geolocalizados} CEBAs fueron geolocalizados y mostrados en el mapa.`);
    mostrarEstado(`✅ Se encontraron ${geolocalizados} CEBAs en el distrito.`);
  } else {
    console.warn("⚠️ [Paso 5] Ninguno de los CEBAs fue geolocalizado con éxito.");
    mostrarEstado("⚠️ No se pudo ubicar ningún CEBA en ese distrito.");
  }

  console.log("🏁 [Paso 6] Proceso completo finalizado.");
}

// -------------------------
// 📍 Detectar ubicación del usuario al cargar
// -------------------------
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function (position) {
    userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    L.marker([userLocation.lat, userLocation.lng])
      .addTo(map)
      .bindPopup("Estás aquí")
      .openPopup();
    map.setView([userLocation.lat, userLocation.lng], 12);
    console.log("📍 [Ubicación] Usuario localizado con éxito.");
  }, () => {
    console.warn("⚠️ [Ubicación] No se pudo obtener la ubicación del usuario.");
  });
} else {
  console.warn("⚠️ [Ubicación] Geolocalización no disponible en este navegador.");
}
