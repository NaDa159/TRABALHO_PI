"use strict";

document.addEventListener("DOMContentLoaded", iniciarAplicacao);

function iniciarAplicacao() {

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js")
            .then(() => atualizarStatus("status-pwa", "Ativo", "status-ok"))
            .catch(() => atualizarStatus("status-pwa", "Local", "status-info"));
    } else {
        atualizarStatus("status-pwa", "N/A", "status-alerta");
    }

    const CFG = {
        centro: [-52.275, -27.635],
        limites: [
            [-52.325, -27.670],
            [-52.225, -27.605]
        ],
        estilo: "https://tiles.openfreemap.org/styles/positron",
        osrm: "https://router.project-osrm.org/route/v1/driving/",
        clima: "https://api.open-meteo.com/v1/forecast"
    };

    const terminal = {
        nome: "Terminal Urbano Central",
        c: [-52.27541, -27.62955]
    };

    const campi = [
        { nome: "URI — Câmpus I", c: [-52.26986, -27.64886], id: "uri1" },
        { nome: "URI — Câmpus II", c: [-52.23225, -27.61247], id: "uri2" }
    ];

    const bairros = [
        ["Centro", -52.273, -27.635],
        ["Fátima", -52.267, -27.649],
        ["Bela Vista", -52.257, -27.645],
        ["Linho", -52.253, -27.638],
        ["José Bonifácio", -52.258, -27.629],
        ["Esperança", -52.262, -27.623],
        ["Morro da Cegonha", -52.270, -27.623],
        ["São Caetano", -52.271, -27.619],
        ["Ipiranga", -52.283, -27.628],
        ["Dal Molin", -52.290, -27.629],
        ["Triângulo", -52.290, -27.634],
        ["Santa Catarina", -52.291, -27.637],
        ["Espírito Santo", -52.284, -27.641],
        ["Parque dos Imigrantes", -52.280, -27.647],
        ["São Cristóvão", -52.274, -27.653],
        ["Cerâmica", -52.284, -27.654],
        ["Vitória I", -52.269, -27.659],
        ["São José", -52.263, -27.656],
        ["Presidente Castelo Branco", -52.257, -27.629],
        ["Estevam Carraro", -52.254, -27.652],
        ["Industrial", -52.248, -27.651],
        ["Atlântico", -52.239, -27.643],
        ["Morada do Sol", -52.245, -27.638],
        ["Parque Lívia", -52.241, -27.635],
        ["São Vicente de Paulo", -52.248, -27.630],
        ["Zimmer", -52.252, -27.623],
        ["Cristal", -52.247, -27.619],
        ["Vale Dourado", -52.287, -27.622],
        ["Jabuticabal", -52.305, -27.631],
        ["Três Vendas", -52.300, -27.642],
        ["Koller", -52.290, -27.645]
    ].map(([nome, lon, lat]) => ({ nome, c: [lon, lat] }));

    const grupos = [
        {
            n: "01",
            nome: "URI Câmpus I",
            desc: "Terminal → URI Câmpus I → Terminal",
            cor: "#7c3aed",
            paradas: ["uri1"],
            min: 22
        },
        {
            n: "02",
            nome: "URI Câmpus II",
            desc: "Terminal → URI Câmpus II → Terminal",
            cor: "#9333ea",
            paradas: ["uri2"],
            min: 28
        },
        {
            n: "03",
            nome: "Centro e bairros próximos",
            desc: "Centro, Fátima, Bela Vista, Linho, José Bonifácio, Esperança e Morro da Cegonha",
            cor: "#2563eb",
            paradas: ["Centro", "Fátima", "Bela Vista", "Linho", "José Bonifácio", "Esperança", "Morro da Cegonha"],
            min: 32
        },
        {
            n: "04",
            nome: "Setor Sul",
            desc: "São Caetano, Ipiranga, Dal Molin, Triângulo, Santa Catarina e Espírito Santo",
            cor: "#dc2626",
            paradas: ["São Caetano", "Ipiranga", "Dal Molin", "Triângulo", "Santa Catarina", "Espírito Santo"],
            min: 35
        },
        {
            n: "05",
            nome: "Setor Norte",
            desc: "Parque dos Imigrantes, São Cristóvão, Cerâmica, Vitória I, São José e Presidente Castelo Branco",
            cor: "#059669",
            paradas: ["Parque dos Imigrantes", "São Cristóvão", "Cerâmica", "Vitória I", "São José", "Presidente Castelo Branco"],
            min: 34
        },
        {
            n: "06",
            nome: "Setor Leste",
            desc: "Estevam Carraro, Industrial, Atlântico, Morada do Sol, Parque Lívia e São Vicente de Paulo",
            cor: "#d97706",
            paradas: ["Estevam Carraro", "Industrial", "Atlântico", "Morada do Sol", "Parque Lívia", "São Vicente de Paulo"],
            min: 38
        },
        {
            n: "07",
            nome: "Setor Oeste",
            desc: "Zimmer, Cristal, Vale Dourado, Jabuticabal, Três Vendas e Koller",
            cor: "#0891b2",
            paradas: ["Zimmer", "Cristal", "Vale Dourado", "Jabuticabal", "Três Vendas", "Koller"],
            min: 37
        }
    ].map(r => ({
        ...r,
        id: "linha-" + r.n,
        coords: [],
        progress: 0,
        marker: null,
        el: null,
        cumulative: [],
        total: 1,
        km: 0
    }));

    const locais = [
        { nome: terminal.nome, c: terminal.c, id: "terminal" },
        ...campi.map(p => ({ nome: p.nome, c: p.c, id: p.id })),
        ...bairros.map(b => ({ nome: b.nome, c: b.c, id: b.nome }))
    ];

    let map = null;
    let mapaPronto = false;
    let selected = grupos[0].id;
    let running = true;
    let last = performance.now();
    let toastTimer = null;
    let idleTimer = null;
    let reconhecimento = null;
    let vozRespostaAtiva = true;
    let leitorInterativoAtivo = false;
    let climaAtual = null;
    let inputAlvoTeclado = null;

    const $ = id => document.getElementById(id);

    /* INICIALIZAÇÃO DO MAPA */
    if (!window.maplibregl) {
        atualizarStatus("status-mapa", "Offline", "status-alerta");
        renderRoutes();
        fillPlanner();
        renderArrivals();
        renderUrbanSchedule();
    } else {
        const limitesCidade = new maplibregl.LngLatBounds(CFG.limites[0], CFG.limites[1]);

        map = new maplibregl.Map({
            container: "map",
            style: CFG.estilo,
            center: CFG.centro,
            zoom: 12.6,
            maxBounds: limitesCidade,
            minZoom: 11.5,
            maxZoom: 18,
            attributionControl: false
        });

        map.on("load", async () => {
            mapaPronto = true;
            map.fitBounds(limitesCidade, { padding: 40, maxZoom: 13, duration: 0 });

            addFixedMarkers();
            addNeighborhoodMarkers();
            setupRouteLayers();
            addBusMarkers();

            renderRoutes();
            fillPlanner();
            renderArrivals();
            renderUrbanSchedule();

            atualizarStatus("status-mapa", "Ativo", "status-ok");

            await loadRoadRoutes();
            highlightRoute();
            requestAnimationFrame(animate);
        });
    }

    function pin(cls, label) {
        const el = document.createElement("div");
        el.className = "map-pin " + cls;
        el.textContent = label;
        return el;
    }

    function popup(marker, title, desc) {
        marker.setPopup(
            new maplibregl.Popup({ offset: 16 }).setHTML(`<strong>${safe(title)}</strong><p style="margin-top:4px;font-size:13px;">${safe(desc)}</p>`)
        );
    }

    function addFixedMarkers() {
        const m = new maplibregl.Marker({ element: pin("terminal", "T"), anchor: "center" })
            .setLngLat(terminal.c).addTo(map);
        popup(m, terminal.nome, "Ponto central de integração das linhas.");

        campi.forEach((p, i) => {
            const marker = new maplibregl.Marker({
                element: pin("universidade", i === 0 ? "I" : "II"),
                anchor: "center"
            }).setLngLat(p.c).addTo(map);
            popup(marker, p.nome, "Câmpus universitário.");
        });

        [
            ["Praça da Bandeira", [-52.2738, -27.6330]],
            ["Catedral São José", [-52.2730, -27.6318]],
            ["Parque Longines Malinowski", [-52.2780, -27.6250]]
        ].forEach(([nome, coord]) => {
            const marker = new maplibregl.Marker({ element: pin("referencia", "•"), anchor: "center" })
                .setLngLat(coord).addTo(map);
            popup(marker, nome, "Ponto de referência em Erechim.");
        });
    }

    function addNeighborhoodMarkers() {
        bairros.forEach(b => {
            const marker = new maplibregl.Marker({ element: pin("parada-bairro", ""), anchor: "center" })
                .setLngLat(b.c).addTo(map);
            popup(marker, "Bairro " + b.nome, "Toque no planejador ou na IA para traçar rota até aqui.");
        });
    }

    function setupRouteLayers() {
        grupos.forEach(r => {
            map.addSource(r.id + "-src", {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [terminal.c, terminal.c] } }
            });
            map.addLayer({
                id: r.id + "-line",
                type: "line",
                source: r.id + "-src",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": r.cor, "line-width": 4, "line-opacity": 0.25 }
            });
        });

        map.addSource("planner-src", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] }
        });
        map.addLayer({
            id: "planner-line",
            type: "line",
            source: "planner-src",
            paint: { "line-color": "#f59e0b", "line-width": 7, "line-dasharray": [2, 1] }
        });
    }

    function addBusMarkers() {
        grupos.forEach(r => {
            const el = document.createElement("div");
            el.className = "bus-animated-marker";
            el.textContent = "🚌";
            r.el = el;

            r.marker = new maplibregl.Marker({ element: el, anchor: "center" })
                .setLngLat(terminal.c).addTo(map);

            el.addEventListener("click", () => {
                selectRoute(r.id);
                toast(`Linha ${r.n} — ${r.nome}`);
            });
        });
    }

    async function loadRoadRoutes() {
        await Promise.all(
            grupos.map(async r => {
                const stops = [
                    terminal.c,
                    ...r.paradas.map(id => {
                        if (id === "uri1") return campi[0].c;
                        if (id === "uri2") return campi[1].c;
                        return bairros.find(b => b.nome === id)?.c;
                    }).filter(Boolean),
                    terminal.c
                ];

                r.coords = stops;

                try {
                    const path = stops.map(c => c.join(",")).join(";");
                    const response = await fetch(`${CFG.osrm}${path}?overview=full&geometries=geojson&steps=false`, {
                        signal: AbortSignal.timeout(15000)
                    });
                    if (!response.ok) throw new Error();
                    const data = await response.json();
                    if (data.code !== "Ok" || !data.routes?.length) throw new Error();
                    r.coords = data.routes[0].geometry.coordinates;
                    r.km = data.routes[0].distance / 1000;
                } catch (err) {
                    r.km = distancePath(stops) / 1000;
                }

                buildCumulative(r);

                if (mapaPronto) {
                    map.getSource(r.id + "-src").setData({
                        type: "Feature",
                        properties: {},
                        geometry: { type: "LineString", coordinates: r.coords }
                    });
                    r.marker.setLngLat(r.coords[0]);
                }
            })
        );
    }

    function buildCumulative(r) {
        r.cumulative = [0];
        let sum = 0;
        for (let i = 1; i < r.coords.length; i++) {
            sum += distance(r.coords[i - 1], r.coords[i]);
            r.cumulative.push(sum);
        }
        r.total = sum || 1;
    }

    function distance(a, b) {
        const rad = x => x * Math.PI / 180;
        const R = 6371000;
        const dlat = rad(b[1] - a[1]);
        const dlon = rad(b[0] - a[0]);
        const x = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(x));
    }

    function distancePath(points) {
        let total = 0;
        for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
        return total;
    }

    function pointAt(r, fraction) {
        const target = fraction * r.total;
        let i = 1;
        while (i < r.cumulative.length && r.cumulative[i] < target) i++;
        if (i >= r.coords.length) return r.coords[r.coords.length - 1];
        const a = r.cumulative[i - 1];
        const b = r.cumulative[i];
        const t = (target - a) / (b - a || 1);
        const p = r.coords[i - 1];
        const q = r.coords[i];
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    }

    function animate(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (running) {
            grupos.forEach(r => {
                if (r.coords.length > 1) {
                    r.progress = (r.progress + dt / (r.min * 60)) % 1;
                    r.marker.setLngLat(pointAt(r, r.progress));
                }
            });
        }
        requestAnimationFrame(animate);
    }

    /* LINHAS & ROTAS */
    function renderRoutes(filter = "") {
        const root = $("rotas-lista");
        if (!root) return;
        root.innerHTML = "";
        const q = normalize(filter);

        const rows = grupos.filter(r =>
            normalize(r.n + " " + r.nome + " " + r.desc).includes(q)
        );

        rows.forEach(r => {
            const button = document.createElement("button");
            button.className = "rota-item" + (r.id === selected ? " selecionada" : "");
            button.innerHTML = `
                <span class="rota-cor" style="background:${r.cor}"></span>
                <span class="rota-informacao">
                    <strong>Linha ${r.n} — ${safe(r.nome)}</strong>
                    <span>${safe(r.desc)}</span>
                </span>
            `;
            button.onclick = () => selectRoute(r.id);
            root.appendChild(button);
        });

        if (!rows.length) root.textContent = "Nenhuma linha encontrada.";
    }

    function selectRoute(id) {
        selected = id;
        const route = grupos.find(r => r.id === id);
        if (!route) return;

        renderRoutes($("busca-linha").value);
        highlightRoute();

        if (route.coords.length && mapaPronto) {
            const bounds = new maplibregl.LngLatBounds();
            route.coords.forEach(c => bounds.extend(c));
            map.fitBounds(bounds, {
                padding: { top: 80, bottom: 120, left: 60, right: 60 },
                maxZoom: 14,
                duration: 650
            });
        }

        $("status-rota").textContent =
            `Linha ${route.n}: ${route.nome} (~${route.km.toFixed(1)} km).`;
    }

    function highlightRoute() {
        if (!mapaPronto) return;
        grupos.forEach(r => {
            const active = r.id === selected;
            if (map.getLayer(r.id + "-line")) {
                map.setPaintProperty(r.id + "-line", "line-width", active ? 8 : 3);
                map.setPaintProperty(r.id + "-line", "line-opacity", active ? 1 : 0.25);
            }
            r.el?.classList.toggle("bus-selecionado", active);
        });
    }

    /* PLANEJADOR */
    function fillPlanner() {
        const origin = $("origin");
        const destination = $("destination");
        origin.innerHTML = "";
        destination.innerHTML = "";

        locais.forEach((p, i) => {
            origin.add(new Option(p.nome, i));
            destination.add(new Option(p.nome, i));
        });
        destination.selectedIndex = 1;

        const now = new Date();
        $("departureTime").value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }

    function findBusLinesForStop(stopId) {
        if (stopId === "terminal") return grupos;
        return grupos.filter(g => g.paradas.includes(stopId));
    }

    async function drawPlanner() {
        const originIndex = Number($("origin").value);
        const destinationIndex = Number($("destination").value);

        if (originIndex === destinationIndex) return toast("Escolha origem e destino diferentes.");

        const a = locais[originIndex];
        const b = locais[destinationIndex];
        if (!a || !b) return;

        const button = $("drawRoute");
        button.disabled = true;
        button.textContent = "Calculando trajeto...";

        const linhasOrigem = findBusLinesForStop(a.id);
        const linhasDestino = findBusLinesForStop(b.id);
        const linhaDireta = linhasOrigem.find(lo => linhasDestino.some(ld => ld.id === lo.id));

        let waypoints = [a.c, b.c];
        let instrucaoOnibus = "";
        let tituloLinha = "";
        let tempoExtraBaldeacao = 0;

        if (linhaDireta) {
            tituloLinha = `Linha ${linhaDireta.n} — ${linhaDireta.nome}`;
            instrucaoOnibus = `1. Embarque em <b>${safe(a.nome)}</b> na <b>Linha ${linhaDireta.n}</b>.<br>2. Desembarque direto em <b>${safe(b.nome)}</b>.`;
            selectRoute(linhaDireta.id);
        } else {
            const l1 = linhasOrigem[0] || grupos[0];
            const l2 = linhasDestino[0] || grupos[0];
            tituloLinha = `Integração: Linha ${l1.n} + Linha ${l2.n}`;
            waypoints = [a.c, terminal.c, b.c];
            tempoExtraBaldeacao = 8;
            instrucaoOnibus = `
                1. Pegue a <b>Linha ${l1.n} (${safe(l1.nome)})</b> em <b>${safe(a.nome)}</b> até o <b>Terminal Urbano Central</b>.<br>
                2. Faça integração gratuita para a <b>Linha ${l2.n} (${safe(l2.nome)})</b>.<br>
                3. Desembarque em <b>${safe(b.nome)}</b>.
            `;
        }

        try {
            const path = waypoints.map(c => c.join(",")).join(";");
            const response = await fetch(`${CFG.osrm}${path}?overview=full&geometries=geojson`, {
                signal: AbortSignal.timeout(15000)
            });

            let distKm = distancePath(waypoints) / 1000;
            let tempoBusMin = Math.max(6, Math.round((distKm / 22) * 60) + tempoExtraBaldeacao);

            if (response.ok) {
                const data = await response.json();
                if (data.code === "Ok" && data.routes?.length) {
                    const route = data.routes[0];
                    distKm = route.distance / 1000;
                    tempoBusMin = Math.max(6, Math.round((route.duration / 60) * 1.45) + tempoExtraBaldeacao);

                    if (mapaPronto) {
                        map.getSource("planner-src").setData({
                            type: "Feature",
                            properties: {},
                            geometry: route.geometry
                        });
                        const bounds = new maplibregl.LngLatBounds();
                        route.geometry.coordinates.forEach(c => bounds.extend(c));
                        map.fitBounds(bounds, { padding: 90, duration: 700 });
                    }
                }
            }

            const horaPartida = $("departureTime").value || "Agora";
            $("routeInfo").hidden = false;
            $("routeLineBadge").textContent = tituloLinha;
            $("routeSteps").innerHTML = instrucaoOnibus;
            $("routeDistance").textContent = `Distância: ${distKm.toFixed(1)} km`;
            $("routeDuration").textContent = `Partida: ${horaPartida} · Tempo estimado: ~${tempoBusMin} min`;

            toast("Rota traçada no mapa!");
        } catch (error) {
            toast("Rota calculada offline.");
        } finally {
            button.disabled = false;
            button.textContent = "Traçar melhor trajeto";
        }
    }

    function clearPlanner() {
        if (mapaPronto) {
            map.getSource("planner-src")?.setData({ type: "FeatureCollection", features: [] });
        }
        $("routeInfo").hidden = true;
        toast("Mapa limpo.");
    }

    function swapPlanner() {
        const a = $("origin");
        const b = $("destination");
        const old = a.value;
        a.value = b.value;
        b.value = old;
    }

    /* HORÁRIOS E CHEGADAS */
    function renderUrbanSchedule() {
        const root = $("horarios-urbanos");
        if (!root) return;

        const schedule = [
            ["06:15 – 23:00", "Linha 01 — URI Câmpus I", "20 a 35 min"],
            ["06:30 – 22:45", "Linha 02 — URI Câmpus II", "30 min"],
            ["06:00 – 23:15", "Linha 03 — Centro e Próximos", "15 min"],
            ["06:10 – 22:50", "Linha 04 — Setor Sul", "25 min"],
            ["06:10 – 22:50", "Linha 05 — Setor Norte", "25 min"],
            ["06:20 – 22:40", "Linha 06 — Setor Leste", "30 min"],
            ["06:20 – 22:40", "Linha 07 — Setor Oeste", "30 min"]
        ];

        root.innerHTML = schedule.map(item => `
            <tr>
                <td><b>${item[0]}</b></td>
                <td>${safe(item[1])}</td>
                <td>${safe(item[2])}</td>
            </tr>
        `).join("");
    }

    function getSimulatedArrivalsData() {
        const hora = new Date().getHours();
        const pico = (hora >= 7 && hora <= 9) || (hora >= 11 && hora <= 13) || (hora >= 17 && hora <= 19);
        return grupos.map((r, i) => {
            const min = 3 + (i * 7 + 4) % 16;
            const nivel = pico ? (i % 2 === 0 ? "alta" : "media") : (i % 3 === 0 ? "media" : "baixa");
            const textoLotacao = nivel === "alta" ? "Lotado" : nivel === "media" ? "Moderado" : "Tranquilo";
            return { linha: r, min, nivel, textoLotacao };
        }).sort((a, b) => a.min - b.min);
    }

    function renderArrivals() {
        const lista = getSimulatedArrivalsData();
        $("chegadas-simuladas").innerHTML = lista.map(item => `
            <div class="cartao-chegada-completo">
                <div class="cartao-chegada-topo">
                    <strong>Linha ${item.linha.n} — ${safe(item.linha.nome)}</strong>
                    <span class="lotacao-badge lotacao-${item.nivel}">${item.textoLotacao}</span>
                </div>
                <div class="cartao-chegada-detalhes">
                    <span>Chegada prevista no Terminal</span>
                    <strong class="tempo-destaque">${item.min} min</strong>
                </div>
            </div>
        `).join("");
    }

    function showQRCode(titulo, textoResumo) {
        const modal = $("modal-qrcode");
        const container = $("qr-imagem-container");
        $("qr-titulo").textContent = titulo;
        $("qr-texto-copia").textContent = textoResumo;

        const encoded = encodeURIComponent(textoResumo);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=210x210&data=${encoded}`;

        container.innerHTML = `<img src="${qrUrl}" alt="QR Code" onerror="this.parentElement.innerHTML='<p style=color:#000;padding:12px;>QR Code indisponível offline.</p>'">`;
        modal.hidden = false;
    }

    /* GERENCIAMENTO DE PAINÉIS E INATIVIDADE */
    function openPanel(name) {
        closePanels();
        const painel = $("painel-" + name);
        painel?.classList.add("aberto");
        document.querySelector(`[data-painel="${name}"]`)?.classList.add("selecionado");

        if (name === "planejador" && mapaPronto) setTimeout(() => map.resize(), 250);
        if (leitorInterativoAtivo && painel) {
            const h2 = painel.querySelector("h2")?.textContent || name;
            speak("Abrindo " + h2);
        }
        resetIdleTimer();
    }

    function closePanels() {
        document.querySelectorAll(".painel-funcionalidade").forEach(p => p.classList.remove("aberto"));
        document.querySelectorAll("[data-painel]").forEach(b => b.classList.remove("selecionado"));
    }

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            closePanels();
            $("modal-qrcode").hidden = true;
            $("teclado-virtual").hidden = true;
            if (document.body.classList.contains("fonte-grande")) setFontSize(false);
            if (document.body.classList.contains("alto-contraste")) setContrast(false);
            if (leitorInterativoAtivo) toggleScreenReaderMode();
        }, 90000); // 90s sem toque restaura o totem para o próximo passageiro
    }

    ["pointerdown", "keydown", "touchstart"].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer, { passive: true })
    );

    /* ACESSIBILIDADE */
    function toggleGroup(ids, active) {
        ids.forEach(id => $(id).classList.toggle("active", id === active));
    }

    function setContrast(high) {
        document.body.classList.toggle("alto-contraste", high);
        toggleGroup(["btn-contraste-padrao", "btn-contraste-alto"], high ? "btn-contraste-alto" : "btn-contraste-padrao");
        toast(high ? "Alto contraste ativado" : "Modo claro ativado");
    }

    function setFontSize(large) {
        document.body.classList.toggle("fonte-grande", large);
        toggleGroup(["btn-fonte-normal", "btn-fonte-maior"], large ? "btn-fonte-maior" : "btn-fonte-normal");
        toast(large ? "Letras ampliadas" : "Tamanho normal");
    }

    function toggleScreenReaderMode() {
        leitorInterativoAtivo = !leitorInterativoAtivo;
        const btn = $("btn-leitor-interativo");
        btn.classList.toggle("active", leitorInterativoAtivo);
        btn.setAttribute("aria-pressed", String(leitorInterativoAtivo));
        btn.textContent = leitorInterativoAtivo ? "🗣️ Narrar ao tocar: LIGADO" : "🗣️ Narrar botões ao tocar: DESLIGADO";

        if (leitorInterativoAtivo) {
            speak("Guia por voz ativado. Toque em qualquer botão para ouvir.");
        } else {
            speechSynthesis?.cancel();
        }
    }

    document.addEventListener("click", e => {
        if (!leitorInterativoAtivo) return;
        const target = e.target.closest("button, a, select, input");
        if (target && target.id !== "btn-leitor-interativo" && target.id !== "btn-parar-voz") {
            const label = target.getAttribute("aria-label") || target.textContent.trim() || target.placeholder;
            if (label) speak(label);
        }
    }, true);

    /* TECLADO VIRTUAL */
    function buildVirtualKeyboard() {
        const container = $("teclado-teclas");
        const layout = [
            ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
            ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
            ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ç"],
            ["Z", "X", "C", "V", "B", "N", "M", "⌫"],
            ["ESPAÇO", "LIMPAR", "CONFIRMAR"]
        ];

        container.innerHTML = layout.map(row => `
            <div class="teclado-row">
                ${row.map(key => {
                    let cls = "tecla-btn";
                    if (key === "ESPAÇO") cls += " tecla-espaco";
                    if (key === "CONFIRMAR" || key === "LIMPAR") cls += " tecla-acao";
                    return `<button type="button" class="${cls}" data-key="${key}">${key}</button>`;
                }).join("")}
            </div>
        `).join("");

        container.querySelectorAll(".tecla-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (!inputAlvoTeclado) inputAlvoTeclado = $("chat-input");
                const key = btn.dataset.key;

                if (key === "⌫") {
                    inputAlvoTeclado.value = inputAlvoTeclado.value.slice(0, -1);
                } else if (key === "ESPAÇO") {
                    inputAlvoTeclado.value += " ";
                } else if (key === "LIMPAR") {
                    inputAlvoTeclado.value = "";
                } else if (key === "CONFIRMAR") {
                    $("teclado-virtual").hidden = true;
                    if (inputAlvoTeclado.id === "chat-input") sendChat();
                } else {
                    inputAlvoTeclado.value += key.toLowerCase();
                }

                inputAlvoTeclado.dispatchEvent(new Event("input"));
                inputAlvoTeclado.focus();
            });
        });
    }

    function openVirtualKeyboard(targetInput, labelText) {
        inputAlvoTeclado = targetInput;
        $("teclado-campo-alvo").textContent = `Digitando em: ${labelText}`;
        $("teclado-virtual").hidden = false;
        targetInput.focus();
    }

    /* INTELIGÊNCIA ARTIFICIAL AVANÇADA E CONTEXTUAL */
    function initChat() {
        renderChatBubble(
            "Assistente",
            "Olá! Toque no microfone ou digite o nome de um bairro, linha ou destino (ex.: 'Como vou para a URI?' ou 'Próximos ônibus').",
            "mensagem-assistente",
            null
        );
    }

    function sendChat(overrideText = null) {
        const input = $("chat-input");
        const question = (overrideText || input.value).trim();
        if (!question) return;

        renderChatBubble("Você", question, "mensagem-usuario", null);
        if (!overrideText) input.value = "";

        const responseObj = getAdvancedAIAnswer(question);

        setTimeout(() => {
            renderChatBubble("Assistente", responseObj.text, "mensagem-assistente", responseObj.action);
            if (vozRespostaAtiva) speak(responseObj.text);
        }, 180);
    }

    function findMentionedLocations(qNorm) {
        const matches = [];
        if (qNorm.includes("terminal") || qNorm.includes("centro")) {
            matches.push({ id: "terminal", nome: "Terminal Urbano Central", index: 0 });
        }
        if (qNorm.includes("uri 1") || qNorm.includes("uri i") || qNorm.includes("campus 1") || qNorm.includes("campus i") || qNorm.includes("universidade") || qNorm.includes("faculdade")) {
            matches.push({ id: "uri1", nome: "URI — Câmpus I", index: 1 });
        }
        if (qNorm.includes("uri 2") || qNorm.includes("uri ii") || qNorm.includes("campus 2") || qNorm.includes("campus ii")) {
            matches.push({ id: "uri2", nome: "URI — Câmpus II", index: 2 });
        }
        bairros.forEach((b, idx) => {
            if (qNorm.includes(normalize(b.nome))) {
                matches.push({ id: b.nome, nome: b.nome, index: idx + 3 });
            }
        });
        return matches;
    }

    function getAdvancedAIAnswer(question) {
        const q = normalize(question);

        // 1. Saudações e ajuda geral
        if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|ajuda|como funciona)/.test(q)) {
            return {
                text: "Estou pronto para ajudar! Você pode dizer o nome do bairro para onde quer ir, perguntar que horas passa o próximo ônibus ou pedir para traçar uma rota.",
                action: { label: "🧭 Abrir Planejador de Rotas", type: "open_panel", panel: "planejador" }
            };
        }

        // 2. Próximas chegadas / Tempo real / Lotação
        if (q.includes("chega") || q.includes("proximo") || q.includes("quanto tempo") || q.includes("vai passar") || q.includes("lotado")) {
            const proximos = getSimulatedArrivalsData().slice(0, 3);
            const resumo = proximos.map(p => `• Linha ${p.linha.n} (${p.linha.nome}): em ${p.min} min (${p.textoLotacao})`).join("\n");
            return {
                text: `Os próximos ônibus previstos no Terminal Urbano são:\n${resumo}`,
                action: { label: "⏱️ Ver todas as chegadas", type: "open_panel", panel: "chegadas" }
            };
        }

        // 3. Trajeto entre DOIS locais na mesma frase (ex: "do Tres Vendas ate a URI")
        const mencionados = findMentionedLocations(q);
        if (mencionados.length >= 2) {
            const orig = mencionados[0];
            const dest = mencionados[1];
            return {
                text: `Entendi! Vou traçar agora mesmo o melhor trajeto de ônibus saindo de ${orig.nome} até ${dest.nome}.`,
                action: {
                    label: `🗺️ Ver rota: ${orig.nome} → ${dest.nome}`,
                    type: "plan_route",
                    originIdx: orig.index,
                    destIdx: dest.index
                }
            };
        }

        // 4. Número específico de linha (ex: "linha 04", "onibus 4")
        const matchLinhaNum = q.match(/(?:linha|onibus|numero)\s*0?([1-7])\b/);
        if (matchLinhaNum) {
            const num = "0" + matchLinhaNum[1];
            const r = grupos.find(g => g.n === num);
            if (r) {
                return {
                    text: `A Linha ${r.n} (${r.nome}) faz o itinerário: ${r.desc}. Percurso de aproximadamente ${r.km.toFixed(1)} km.`,
                    action: { label: `🚌 Destacar Linha ${r.n} no mapa`, type: "select_route", id: r.id }
                };
            }
        }

        // 5. URI Câmpus I ou II
        if (q.includes("uri") || q.includes("campus") || q.includes("faculdade") || q.includes("universidade")) {
            if (q.includes("2") || q.includes("ii")) {
                return {
                    text: "Para ir à URI Câmpus II, pegue a Linha 02 no Terminal Urbano Central (saídas a cada 30 min).",
                    action: { label: "🚌 Ver Linha 02 no mapa", type: "select_route", id: "linha-02" }
                };
            }
            return {
                text: "Para a URI Câmpus I, utilize a Linha 01 saindo do Terminal Urbano Central (saídas a cada 20 min nos horários de pico).",
                action: { label: "🚌 Ver Linha 01 no mapa", type: "select_route", id: "linha-01" }
            };
        }

        // 6. Um bairro mencionado (ex: "Como vou para o Três Vendas?", "Qual ônibus passa no Fátima?")
        if (mencionados.length === 1 && mencionados[0].id !== "terminal") {
            const local = mencionados[0];
            const rota = grupos.find(r => r.paradas.includes(local.id));
            if (rota) {
                return {
                    text: `O bairro ${local.nome} é atendido pela Linha ${rota.n} — ${rota.nome}, com saída do Terminal Urbano Central.`,
                    action: {
                        label: `🧭 Traçar rota até ${local.nome}`,
                        type: "plan_route",
                        originIdx: 0,
                        destIdx: local.index
                    }
                };
            }
        }

        // 7. Clima / Chuva / Temperatura
        if (q.includes("clima") || q.includes("tempo") || q.includes("chover") || q.includes("chuva") || q.includes("frio") || q.includes("calor") || q.includes("temperatura")) {
            if (climaAtual) {
                return {
                    text: `Agora em Erechim faz ${climaAtual.temperatura}°C (${climaAtual.descricao}), com sensação térmica de ${climaAtual.sensacao}°C e umidade de ${climaAtual.umidade}%.`
                };
            }
            return { text: "A previsão atualizada está exibida no topo da tela." };
        }

        // 8. Integração / Tarifa / Terminal
        if (q.includes("integracao") || q.includes("baldeacao") || q.includes("trocar") || q.includes("terminal") || q.includes("passagem")) {
            return {
                text: "Todas as 7 linhas convergem no Terminal Urbano Central, onde você pode fazer integração para qualquer setor da cidade.",
                action: { label: "📍 Centralizar Terminal no Mapa", type: "fly_terminal" }
            };
        }

        // 9. Horários
        if (q.includes("horario") || q.includes("que horas") || q.includes("sabado") || q.includes("domingo")) {
            return {
                text: "Nos dias úteis, os ônibus operam das 06:00 às 23:15. Aos sábados das 06:30 às 22:30 e domingos das 07:30 às 21:00.",
                action: { label: "🕒 Abrir Quadro de Horários", type: "open_panel", panel: "horarios" }
            };
        }

        // 10. Acessibilidade / Fonte
        if (q.includes("letra") || q.includes("pequeno") || q.includes("enxergar") || q.includes("acessibilidade") || q.includes("contraste")) {
            return {
                text: "Você pode aumentar o tamanho das letras ou ativar o Alto Contraste no menu Acessível.",
                action: { label: "♿ Abrir Acessibilidade", type: "open_panel", panel: "acessibilidade" }
            };
        }

        // 11. Contatos / Emergência
        if (q.includes("telefone") || q.includes("contato") || q.includes("gaurama") || q.includes("emergencia") || q.includes("policia") || q.includes("samu")) {
            return {
                text: "Emergências: SAMU 192, Polícia 190, Bombeiros 193. Transportes Gaurama: (54) 3321-3637.",
                action: { label: "🆘 Abrir Ajuda e Contatos", type: "open_panel", panel: "ajuda" }
            };
        }

        // Fallback inteligente com sugestão de ação
        return {
            text: `Não encontrei um destino exato para "${question}", mas você pode escolher seu bairro no Planejador de Rotas ou ver todas as 7 linhas disponíveis.`,
            action: { label: "🧭 Escolher destino no Planejador", type: "open_panel", panel: "planejador" }
        };
    }

    function normalize(text) {
        return text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function renderChatBubble(author, text, cls, action = null) {
        const div = document.createElement("div");
        div.className = "chat-mensagem " + cls;
        div.textContent = text;

        if (action) {
            const card = document.createElement("div");
            card.className = "chat-acao-card";
            const btn = document.createElement("button");
            btn.textContent = action.label;
            btn.onclick = () => {
                if (action.type === "select_route") {
                    openPanel("linhas");
                    selectRoute(action.id);
                } else if (action.type === "open_panel") {
                    openPanel(action.panel);
                } else if (action.type === "fly_terminal" && mapaPronto) {
                    closePanels();
                    map.flyTo({ center: terminal.c, zoom: 15 });
                } else if (action.type === "plan_route") {
                    openPanel("planejador");
                    $("origin").selectedIndex = action.originIdx;
                    $("destination").selectedIndex = action.destIdx;
                    drawPlanner();
                }
            };
            card.appendChild(btn);
            div.appendChild(card);
        }

        $("chat-log").appendChild(div);
        $("chat-log").scrollTop = $("chat-log").scrollHeight;
    }

    function clearChat() {
        $("chat-log").innerHTML = "";
        initChat();
        speechSynthesis?.cancel();
    }

    /* VOZ DIRETA E RECONHECIMENTO DE FALA */
    function startVoiceAssistantDirectly() {
        openPanel("assistente");
        voiceInput();
    }

    function voiceInput() {
        const API = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!API) {
            toast("Microfone não suportado neste navegador. Use o teclado!");
            openVirtualKeyboard($("chat-input"), "Pergunta ao Assistente");
            return;
        }

        if (reconhecimento) {
            reconhecimento.stop();
            reconhecimento = null;
            return;
        }

        speechSynthesis?.cancel();
        reconhecimento = new API();
        reconhecimento.lang = "pt-BR";
        reconhecimento.continuous = false;
        reconhecimento.interimResults = false;

        reconhecimento.onstart = () => {
            $("status-voz").hidden = false;
            $("chat-mic").textContent = "⏹";
        };
        reconhecimento.onresult = event => {
            const falado = event.results[0][0].transcript;
            sendChat(falado);
        };
        reconhecimento.onerror = () => {
            toast("Não consegui ouvir. Tente falar mais perto ou digite.");
        };
        reconhecimento.onend = () => {
            $("status-voz").hidden = true;
            $("chat-mic").textContent = "🎙️";
            reconhecimento = null;
        };

        try {
            reconhecimento.start();
        } catch (e) {
            reconhecimento = null;
        }
    }

    function speak(text) {
        if (!("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.rate = 1.02;
        const ptVoice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("pt"));
        if (ptVoice) utterance.voice = ptVoice;
        speechSynthesis.speak(utterance);
    }

    function toggleVoiceAnswer() {
        vozRespostaAtiva = !vozRespostaAtiva;
        $("chat-voz-resposta").textContent = vozRespostaAtiva ? "🔊 Resposta falada: ON" : "🔇 Resposta falada: OFF";
        $("chat-voz-resposta").setAttribute("aria-pressed", String(vozRespostaAtiva));
        if (!vozRespostaAtiva) speechSynthesis?.cancel();
    }

    function readSummary() {
        speak("Parada Inteligente de Erechim. Você está no Terminal Urbano Central. Toque no botão azul Falar com a IA na parte inferior para perguntar sobre qualquer linha ou bairro.");
    }

    function stopSpeech() {
        speechSynthesis?.cancel();
        if (reconhecimento) reconhecimento.stop();
        toast("Áudio silenciado.");
    }

    /* RELÓGIO E CLIMA */
    function updateClock() {
        const now = new Date();
        $("data-atual").textContent = now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
        $("hora-atual").textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    function weatherDescription(code) {
        const descriptions = {
            0: ["Céu limpo", "☀️"], 1: ["Sol", "🌤️"], 2: ["Parc. nublado", "⛅"],
            3: ["Nublado", "☁️"], 45: ["Neblina", "🌫️"], 51: ["Garoa", "🌦️"],
            61: ["Chuva fraca", "🌧️"], 63: ["Chuva", "🌧️"], 65: ["Chuva forte", "🌧️"],
            80: ["Pancadas", "🌦️"], 95: ["Trovoadas", "⛈️"]
        };
        return descriptions[code] || ["Variável", "🌡️"];
    }

    async function weather() {
        const url = `${CFG.clima}?latitude=-27.6296&longitude=-52.2754&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=America%2FSao_Paulo&forecast_days=1`;

        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error();
            const data = await response.json();
            const current = data.current;
            const description = weatherDescription(current.weather_code);

            $("temperatura-atual").textContent = `${Math.round(current.temperature_2m)}°C`;
            $("icone-clima").textContent = description[1];
            $("detalhe-clima").textContent = description[0];
            $("weather-details").textContent = `Sensação ${Math.round(current.apparent_temperature)}° · Umidade ${Math.round(current.relative_humidity_2m)}%`;

            climaAtual = {
                temperatura: Math.round(current.temperature_2m),
                sensacao: Math.round(current.apparent_temperature),
                umidade: Math.round(current.relative_humidity_2m),
                descricao: description[0]
            };

            atualizarStatus("status-clima", "OK", "status-ok");
        } catch (error) {
            $("detalhe-clima").textContent = "Offline";
            atualizarStatus("status-clima", "Offline", "status-alerta");
        }
    }

    function atualizarStatus(id, texto, classe) {
        const el = $(id);
        if (!el) return;
        el.textContent = texto;
        el.className = "status-tag " + (classe || "");
    }

    function updateSystemInfo() {
        $("status-internet").textContent = navigator.onLine
            ? "Conectado à internet · Atualizado em " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : "Modo Offline ativo (dados locais disponíveis)";
        const voiceAvailable = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        atualizarStatus("status-voz-totem", voiceAvailable ? "Ativa" : "Indisp.", voiceAvailable ? "status-ok" : "status-alerta");
    }

    /* EVENTOS DA INTERFACE */
    function configureUI() {
        document.querySelectorAll("[data-painel]").forEach(b => b.onclick = () => openPanel(b.dataset.painel));
        document.querySelectorAll(".fechar-painel").forEach(b => {
            if (b.id !== "fechar-qrcode") b.onclick = closePanels;
        });

        $("btn-voz-direta").onclick = startVoiceAssistantDirectly;

        $("btn-fullscreen").onclick = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
                document.exitFullscreen?.();
            }
        };

        $("btn-zoom-in").onclick = () => map?.zoomIn();
        $("btn-zoom-out").onclick = () => map?.zoomOut();
        $("locate").onclick = () => map?.flyTo({ center: terminal.c, zoom: 15, duration: 700 });

        $("view2d").onclick = () => {
            map?.easeTo({ pitch: 0, bearing: 0 });
            ["view2d", "view3d"].forEach(id => $(id).classList.toggle("active", id === "view2d"));
        };
        $("view3d").onclick = () => {
            map?.easeTo({ pitch: 50, bearing: -15 });
            ["view2d", "view3d"].forEach(id => $(id).classList.toggle("active", id === "view3d"));
        };

        $("busca-linha").oninput = e => renderRoutes(e.target.value);
        $("btn-iniciar-onibus").onclick = () => { running = true; toast("Simulação iniciada"); };
        $("btn-pausar-onibus").onclick = () => { running = false; toast("Simulação pausada"); };
        $("btn-reiniciar-onibus").onclick = () => {
            grupos.forEach(r => { r.progress = 0; r.marker?.setLngLat(r.coords[0] || terminal.c); });
            running = true;
            toast("Ônibus reiniciados");
        };

        $("btn-qrcode-linha").onclick = () => {
            const r = grupos.find(g => g.id === selected);
            if (r) showQRCode(`Linha ${r.n} — ${r.nome}`, `Parada Inteligente Erechim | Linha ${r.n}: ${r.desc}`);
        };

        $("btn-qrcode-horarios").onclick = () => {
            showQRCode(
                "Horários — Erechim",
                "Parada Inteligente Erechim | Seg-Sex 06:00 às 23:15. Consulta oficial: https://urbanoerechim.com.br/"
            );
        };

        $("fechar-qrcode").onclick = () => $("modal-qrcode").hidden = true;
        $("modal-qrcode").onclick = e => { if (e.target.id === "modal-qrcode") $("modal-qrcode").hidden = true; };

        $("drawRoute").onclick = drawPlanner;
        $("clearRoute").onclick = clearPlanner;
        $("swapRoute").onclick = swapPlanner;

        $("btn-contraste-padrao").onclick = () => setContrast(false);
        $("btn-contraste-alto").onclick = () => setContrast(true);
        $("btn-fonte-normal").onclick = () => setFontSize(false);
        $("btn-fonte-maior").onclick = () => setFontSize(true);
        $("btn-leitor-interativo").onclick = toggleScreenReaderMode;
        $("btn-leitura-voz").onclick = readSummary;
        $("btn-parar-voz").onclick = stopSpeech;

        $("btn-abrir-teclado").onclick = () => openVirtualKeyboard($("chat-input"), "Pergunta ao Assistente");
        $("btn-teclado-busca").onclick = () => openVirtualKeyboard($("busca-linha"), "Buscar Bairro ou Linha");
        $("btn-toggle-teclado-acess").onclick = () => {
            const tv = $("teclado-virtual");
            if (tv.hidden) openVirtualKeyboard($("chat-input"), "Assistente Virtual");
            else tv.hidden = true;
        };
        $("fechar-teclado").onclick = () => $("teclado-virtual").hidden = true;

        $("chat-enviar").onclick = () => sendChat();
        $("chat-input").onkeydown = e => { if (e.key === "Enter") sendChat(); };
        $("chat-mic").onclick = voiceInput;
        $("chat-limpar").onclick = clearChat;
        $("chat-voz-resposta").onclick = toggleVoiceAnswer;

        document.querySelectorAll("[data-sugestao]").forEach(btn => {
            btn.onclick = () => sendChat(btn.dataset.sugestao);
        });

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                closePanels();
                $("modal-qrcode").hidden = true;
                $("teclado-virtual").hidden = true;
            }
        });
    }

    function toast(message) {
        const el = $("toast");
        if (!el) return;
        el.textContent = message;
        el.classList.add("visivel");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("visivel"), 2800);
    }

    function safe(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[char]));
    }

    buildVirtualKeyboard();
    initChat();
    configureUI();
    updateClock();
    setInterval(updateClock, 1000);
    updateSystemInfo();
    weather();
    setInterval(weather, 15 * 60 * 1000);
    resetIdleTimer();

    window.addEventListener("online", updateSystemInfo);
    window.addEventListener("offline", updateSystemInfo);
    window.addEventListener("resize", () => { if (mapaPronto) map.resize(); });
}