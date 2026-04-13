/**
 * Generates a self-contained HTML string for the branch tree visualization.
 * The HTML loads data from /data and receives real-time updates via /events SSE.
 */

export function generateTreeHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SOULKILLER — Branch Tree</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0a0a0f;
  color: #c0c0c0;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  overflow: hidden;
  height: 100vh;
}
.header {
  background: linear-gradient(180deg, #12121a 0%, #0a0a0f 100%);
  border-bottom: 1px solid #1a1a2e;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}
.header-title { font-size: 14px; color: #00f7ff; letter-spacing: 2px; text-transform: uppercase; }
.header-info { font-size: 12px; color: #666; }
.header-info span { color: #00f7ff; }
.legend {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(18, 18, 26, 0.95); border: 1px solid #1a1a2e;
  border-radius: 8px; padding: 10px 20px;
  display: flex; gap: 24px; font-size: 12px; z-index: 100;
  backdrop-filter: blur(8px);
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }
.legend-dot.visited { background: #00f7ff; box-shadow: 0 0 6px #00f7ff66; }
.legend-dot.current { background: #f3e600; box-shadow: 0 0 6px #f3e60066; }
.legend-dot.unexplored { background: #333; border: 1px solid #555; }
.legend-dot.chosen { background: #ed1e79; box-shadow: 0 0 6px #ed1e7966; }
.canvas-wrap { width: 100%; height: calc(100vh - 57px); overflow: auto; cursor: grab; }
.canvas-wrap:active { cursor: grabbing; }
.canvas { position: relative; min-width: 100%; min-height: 100%; padding: 60px; }
.lines-svg { position: absolute; top: 0; left: 0; pointer-events: none; }
.scene-node {
  position: absolute; width: 200px; border-radius: 6px;
  border: 1px solid #1a1a2e; background: #12121a;
  transition: border-color 0.3s, box-shadow 0.3s, opacity 0.3s;
  cursor: pointer; user-select: none;
}
.scene-node:hover { border-color: #00f7ff44; box-shadow: 0 0 20px rgba(0,247,255,0.08); }
.scene-node.visited { border-color: #00f7ff33; }
.scene-node.current { border-color: #f3e600; box-shadow: 0 0 20px rgba(243,230,0,0.15); }
.scene-node.unexplored { opacity: 0.45; }
.scene-node.gate {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  width: 160px; height: 160px;
  border-radius: 0; border: none;
  background: #12121a;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
}
.scene-node.gate::before {
  content: ''; position: absolute; inset: 0;
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  border: 2px dashed #f3e600; box-sizing: border-box;
  pointer-events: none;
}
.scene-node.gate .scene-header { border-bottom: none; flex-direction: column; gap: 2px; padding: 4px; }
.scene-node.gate .scene-choices { display: none; }
.scene-node.gate .scene-title { white-space: normal; font-size: 11px; text-align: center; }
.scene-node.new-visit { animation: nodeAppear 0.6s ease-out; }
@keyframes nodeAppear {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.scene-header {
  padding: 8px 12px; border-bottom: 1px solid #1a1a2e;
  display: flex; align-items: center; gap: 8px;
}
.scene-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.scene-status.visited { background: #00f7ff; box-shadow: 0 0 4px #00f7ff88; }
.scene-status.current { background: #f3e600; box-shadow: 0 0 4px #f3e60088; animation: pulse 2s ease-in-out infinite; }
.scene-status.unexplored { background: #333; border: 1px solid #555; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 4px #f3e60088; } 50% { box-shadow: 0 0 12px #f3e600cc; } }
.scene-id { font-size: 11px; color: #666; flex-shrink: 0; }
.scene-title {
  font-size: 12px; color: #e0e0e0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.scene-choices { padding: 6px 0; }
.choice-row {
  padding: 4px 12px; font-size: 11px;
  display: flex; align-items: center; gap: 6px; color: #888;
  transition: background 0.15s;
}
.choice-row:hover { background: #ffffff08; }
.choice-row.chosen { color: #ed1e79; }
.choice-label { color: #555; font-size: 10px; flex-shrink: 0; width: 16px; }
.choice-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.choice-star { color: #ed1e79; font-size: 9px; flex-shrink: 0; }
.tooltip {
  position: fixed; background: rgba(18,18,26,0.97); border: 1px solid #00f7ff33;
  border-radius: 6px; padding: 12px 16px; font-size: 12px;
  max-width: 320px; z-index: 200; pointer-events: none; display: none;
  backdrop-filter: blur(8px);
}
.tooltip-scene { color: #00f7ff; margin-bottom: 4px; }
.tooltip-text { color: #999; line-height: 1.5; }
.tooltip-state { color: #666; margin-top: 8px; font-size: 11px; }
.tooltip-state span { color: #f3e600; }
.stats {
  position: fixed; top: 70px; right: 20px;
  background: rgba(18,18,26,0.95); border: 1px solid #1a1a2e;
  border-radius: 8px; padding: 16px; font-size: 12px;
  z-index: 100; min-width: 180px;
}
.stats-title { color: #00f7ff; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
.stats-row { display: flex; justify-content: space-between; margin-bottom: 6px; color: #888; }
.stats-row .val { color: #e0e0e0; }
.stats-bar { height: 3px; background: #1a1a2e; border-radius: 2px; margin-top: 12px; overflow: hidden; }
.stats-bar-fill { height: 100%; background: linear-gradient(90deg, #00f7ff, #ed1e79); border-radius: 2px; transition: width 0.5s ease; }
.legend-dot.gate { background: none; border: 2px dashed #f3e600; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); border-radius: 0; width: 12px; height: 12px; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: #00f7ff; font-size: 14px; }
</style>
</head>
<body>
<div class="header">
  <div class="header-title">Soulkiller Branch Tree</div>
  <div class="header-info" id="headerInfo">Loading...</div>
</div>
<div class="canvas-wrap" id="canvasWrap">
  <div class="canvas" id="canvas">
    <svg class="lines-svg" id="linesSvg"></svg>
  </div>
</div>
<div class="stats" id="stats"></div>
<div class="legend" id="legend">
  <div class="legend-item"><div class="legend-dot visited"></div> Visited</div>
  <div class="legend-item"><div class="legend-dot current"></div> Current</div>
  <div class="legend-item"><div class="legend-dot unexplored"></div> Unexplored</div>
  <div class="legend-item"><div class="legend-dot chosen"></div> Your choice</div>
  <div class="legend-item"><div class="legend-dot gate"></div> Gate</div>
</div>
<div class="tooltip" id="tooltip">
  <div class="tooltip-scene"></div>
  <div class="tooltip-text"></div>
  <div class="tooltip-state"></div>
</div>
<script>
const COL_W = 260, NODE_W = 200, GATE_W = 160, GATE_CY = 80, NODE_CY = 40, ROW_H = 120;
const ROUTE_COLORS = { common: '#c0c0c0', route_0: '#00f7ff', route_1: '#ed1e79', route_2: '#f3e600', route_3: '#00ff88' };
let prevVisited = new Set();

async function loadData() {
  const res = await fetch('/data');
  return res.json();
}

function getRouteColor(scene, routes) {
  if (!scene) return ROUTE_COLORS.common;
  if (scene.type === 'affinity_gate') return '#f3e600';
  if (scene.route && routes && routes.length > 0) {
    const idx = routes.indexOf(scene.route);
    if (idx >= 0 && idx <= 3) return ROUTE_COLORS['route_' + idx];
    return ROUTE_COLORS.common;
  }
  return ROUTE_COLORS.common;
}

function renderTree(data) {
  const { scenes, history, currentScene, endings, scriptId, routes, gateScenes } = data;
  const historySet = new Set(history);
  const visitedScenes = new Set(history.map(h => h.split(':')[0]));
  visitedScenes.add(currentScene);

  // Header
  document.getElementById('headerInfo').innerHTML =
    'Script: <span>' + scriptId + '</span> | Current: <span>' + currentScene + '</span> | Steps: <span>' + history.length + '</span>';

  // Layout
  const positions = {}, edges = [], colSlots = {}, laid = new Set();
  const queue = [{ id: Object.keys(scenes)[0], depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (laid.has(id)) continue;
    laid.add(id);
    if (!colSlots[depth]) colSlots[depth] = 0;
    positions[id] = { x: 60 + depth * COL_W, y: 60 + colSlots[depth] * ROW_H, depth };
    colSlots[depth]++;
    const scene = scenes[id];
    if (!scene) continue;
    for (const choice of scene.choices) {
      if (choice.next) {
        edges.push({ from: id, to: choice.next, choiceId: choice.id, chosen: historySet.has(id + ':' + choice.id) });
        if (!laid.has(choice.next)) queue.push({ id: choice.next, depth: depth + 1 });
      }
    }
    // Gate scenes: follow routing edges
    if (scene.type === 'affinity_gate' && scene.routing) {
      for (const r of scene.routing) {
        if (r.next) {
          edges.push({ from: id, to: r.next, routeId: r.route_id, isRouting: true, chosen: false });
          if (!laid.has(r.next)) queue.push({ id: r.next, depth: depth + 1 });
        }
      }
    }
  }
  // Endings
  if (endings) {
    for (const [eid, edata] of Object.entries(endings)) {
      if (!laid.has(eid)) {
        const inE = edges.filter(e => e.to === eid);
        const d = inE.length > 0 ? Math.max(...inE.map(e => (positions[e.from]?.depth ?? 0) + 1)) : 5;
        if (!colSlots[d]) colSlots[d] = 0;
        positions[eid] = { x: 60 + d * COL_W, y: 60 + colSlots[d] * ROW_H, depth: d };
        colSlots[d]++;
        laid.add(eid);
      }
    }
  }

  // Canvas size
  const canvas = document.getElementById('canvas');
  const svg = document.getElementById('linesSvg');
  let maxX = 0, maxY = 0;
  for (const pos of Object.values(positions)) { maxX = Math.max(maxX, pos.x + NODE_W + 60); maxY = Math.max(maxY, pos.y + 140); }
  canvas.style.width = maxX + 'px'; canvas.style.height = maxY + 'px';
  svg.setAttribute('width', maxX); svg.setAttribute('height', maxY);

  // Clear
  svg.innerHTML = '';
  canvas.querySelectorAll('.scene-node').forEach(n => n.remove());

  // Edges
  for (const edge of edges) {
    const from = positions[edge.from], to = positions[edge.to];
    if (!from || !to) continue;
    const fromScene = scenes[edge.from], toScene = scenes[edge.to];
    const fromIsGate = fromScene && fromScene.type === 'affinity_gate';
    const toIsGate = toScene && toScene.type === 'affinity_gate';
    const x1 = from.x + (fromIsGate ? GATE_W : NODE_W);
    const y1 = from.y + (fromIsGate ? GATE_CY : NODE_CY);
    const x2 = to.x;
    const y2 = to.y + (toIsGate ? GATE_CY : NODE_CY);
    // Routing edges: use route color + dashed line
    let color, opacity, width;
    if (edge.isRouting) {
      const rIdx = routes.indexOf(edge.routeId);
      color = rIdx >= 0 && rIdx <= 3 ? ROUTE_COLORS['route_' + rIdx] : '#f3e600';
      opacity = 0.7;
      width = 2;
    } else {
      color = edge.chosen ? '#ed1e79' : '#1a1a2e';
      opacity = edge.chosen ? 0.8 : 0.4;
      width = edge.chosen ? 2 : 1;
    }
    const midX = (x1 + x2) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    if (from.depth >= (positions[edge.to]?.depth ?? 0)) {
      const cy = Math.min(y1, y2) - 40;
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1+60) + ' ' + cy + ', ' + (x2-60) + ' ' + cy + ', ' + x2 + ' ' + y2);
    } else {
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + midX + ' ' + y1 + ', ' + midX + ' ' + y2 + ', ' + x2 + ' ' + y2);
    }
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width); path.setAttribute('opacity', opacity);
    if (edge.isRouting) path.setAttribute('stroke-dasharray', '8 4');
    if (edge.chosen) path.setAttribute('filter', 'drop-shadow(0 0 4px rgba(237,30,121,0.3))');
    svg.appendChild(path);
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arrow.setAttribute('cx', x2 - 2); arrow.setAttribute('cy', y2);
    arrow.setAttribute('r', 3); arrow.setAttribute('fill', color); arrow.setAttribute('opacity', opacity);
    svg.appendChild(arrow);
  }

  // Nodes
  const tooltip = document.getElementById('tooltip');
  const routesList = routes || [];
  const gateSet = new Set(gateScenes || []);
  for (const [id, pos] of Object.entries(positions)) {
    const scene = scenes[id]; const ending = endings?.[id];
    const isVisited = visitedScenes.has(id); const isCurrent = id === currentScene;
    const status = isCurrent ? 'current' : isVisited ? 'visited' : 'unexplored';
    const isNew = isVisited && !prevVisited.has(id);
    const isGate = gateSet.has(id) || (scene && scene.type === 'affinity_gate');
    const routeColor = getRouteColor(scene, routesList);

    const node = document.createElement('div');
    node.className = 'scene-node ' + status + (isNew ? ' new-visit' : '') + (isGate ? ' gate' : '');
    node.style.left = pos.x + 'px'; node.style.top = pos.y + 'px';
    if (routeColor !== ROUTE_COLORS.common && !isGate) {
      node.style.borderColor = routeColor + '66';
    }

    const header = document.createElement('div'); header.className = 'scene-header';
    const dot = document.createElement('div'); dot.className = 'scene-status ' + status;
    if (routeColor !== ROUTE_COLORS.common) {
      dot.style.background = routeColor;
      dot.style.boxShadow = '0 0 4px ' + routeColor + '88';
    }
    header.appendChild(dot);
    const idLabel = document.createElement('span'); idLabel.className = 'scene-id';
    idLabel.textContent = ending ? '[ END ]' : isGate ? '[ GATE ]' : id; header.appendChild(idLabel);
    const title = document.createElement('span'); title.className = 'scene-title';
    const txt = ending ? ending.text
      : isGate ? (scene?.routing ? scene.routing.length + ' routes' : 'GATE')
      : (scene?.text?.slice(0, 40) + (scene?.text?.length > 40 ? '...' : '') || '');
    title.textContent = txt; header.appendChild(title);
    node.appendChild(header);

    if (scene && scene.choices.length > 0) {
      const cd = document.createElement('div'); cd.className = 'scene-choices';
      scene.choices.forEach((choice, i) => {
        const row = document.createElement('div');
        const wasChosen = historySet.has(id + ':' + choice.id);
        row.className = 'choice-row' + (wasChosen ? ' chosen' : '');
        const label = document.createElement('span'); label.className = 'choice-label';
        label.textContent = String.fromCharCode(65 + i); row.appendChild(label);
        const text = document.createElement('span'); text.className = 'choice-text';
        text.textContent = choice.text; row.appendChild(text);
        if (wasChosen) {
          const star = document.createElement('span'); star.className = 'choice-star';
          star.textContent = '  \\u2605'; row.appendChild(star);
        }
        cd.appendChild(row);
      });
      node.appendChild(cd);
    }

    node.addEventListener('mouseenter', () => {
      const t = ending ? 'Ending: ' + ending.text : (scene?.text || '');
      tooltip.querySelector('.tooltip-scene').textContent = id;
      tooltip.querySelector('.tooltip-text').textContent = t;
      tooltip.querySelector('.tooltip-state').innerHTML = isCurrent
        ? 'Status: <span>CURRENT POSITION</span>'
        : isVisited ? 'Status: <span>VISITED</span>' : 'Status: UNEXPLORED';
      tooltip.style.display = 'block';
    });
    node.addEventListener('mousemove', (e) => { tooltip.style.left = (e.clientX+16)+'px'; tooltip.style.top = (e.clientY+16)+'px'; });
    node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    canvas.appendChild(node);
  }

  // Stats
  const totalScenes = Object.keys(scenes).length;
  const explored = [...Object.keys(scenes)].filter(s => visitedScenes.has(s)).length;
  const endingCount = endings ? Object.keys(endings).length : 0;
  const endingsFound = endings ? Object.keys(endings).filter(e => visitedScenes.has(e)).length : 0;
  document.getElementById('stats').innerHTML =
    '<div class="stats-title">Progress</div>' +
    '<div class="stats-row"><span>Scenes explored</span><span class="val">' + explored + ' / ' + totalScenes + '</span></div>' +
    '<div class="stats-row"><span>Choices made</span><span class="val">' + history.length + '</span></div>' +
    '<div class="stats-row"><span>Endings found</span><span class="val">' + endingsFound + ' / ' + endingCount + '</span></div>' +
    '<div class="stats-bar"><div class="stats-bar-fill" style="width:' + Math.round(explored/totalScenes*100) + '%"></div></div>';

  prevVisited = new Set(visitedScenes);

  // Dynamic route legend
  const legend = document.getElementById('legend');
  legend.querySelectorAll('.legend-route').forEach(el => el.remove());
  if (routesList.length > 0) {
    routesList.forEach((r, i) => {
      const color = ROUTE_COLORS['route_' + i] || ROUTE_COLORS.common;
      const item = document.createElement('div');
      item.className = 'legend-item legend-route';
      item.innerHTML = '<div class="legend-dot" style="background:' + color + ';box-shadow:0 0 6px ' + color + '66"></div> ' + r;
      legend.appendChild(item);
    });
  }

  // Scroll to current
  const currentPos = positions[currentScene];
  if (currentPos) {
    const wrap = document.getElementById('canvasWrap');
    wrap.scrollTo({ left: currentPos.x - wrap.clientWidth/2 + NODE_W/2, top: currentPos.y - wrap.clientHeight/2 + 50, behavior: 'smooth' });
  }
}

// Pan
const wrap = document.getElementById('canvasWrap');
let isPanning = false, startX, startY, scrollX, scrollY;
wrap.addEventListener('mousedown', (e) => { if (e.target.closest('.scene-node')) return; isPanning = true; startX = e.clientX; startY = e.clientY; scrollX = wrap.scrollLeft; scrollY = wrap.scrollTop; });
window.addEventListener('mousemove', (e) => { if (!isPanning) return; wrap.scrollLeft = scrollX - (e.clientX - startX); wrap.scrollTop = scrollY - (e.clientY - startY); });
window.addEventListener('mouseup', () => { isPanning = false; });

// Init
loadData().then(renderTree);

// SSE
const sse = new EventSource('/events');
sse.addEventListener('update', (e) => { renderTree(JSON.parse(e.data)); });
sse.addEventListener('switch', (e) => { renderTree(JSON.parse(e.data)); });
</script>
</body>
</html>`;
}
