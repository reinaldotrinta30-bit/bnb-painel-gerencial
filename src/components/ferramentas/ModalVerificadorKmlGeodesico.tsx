'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

interface ModalVerificadorKmlGeodesicoProps {
  aberto: boolean;
  onFechar: () => void;
}

// Carrega Leaflet e Turf.js dinamicamente no navegador
async function garantirBibliotecasGeodesicas(): Promise<{
  L: any;
  turf: any;
}> {
  if (typeof window === 'undefined') return { L: null, turf: null };
  const win = window as any;

  // 1. CSS do Leaflet
  if (!document.getElementById('leaflet-css-cdn')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css-cdn';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  // 2. Script do Leaflet
  if (!win.L) {
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  // 3. Script do Turf.js v6
  if (!win.turf) {
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  return { L: win.L, turf: win.turf };
}

export default function ModalVerificadorKmlGeodesico({
  aberto,
  onFechar,
}: ModalVerificadorKmlGeodesicoProps) {
  const containerRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    let cancelado = false;
    let rsMap: any = null;
    let rsLayersGroup: Record<string, any> = {};
    let rsGlebasColors: Record<string, string> = {};
    let rsActiveGlebaEdit: string | null = null;
    let rsGlebasData: Record<string, Array<[number, number, number]>> = {};

    let rsRiskData: Record<string, Array<Array<[number, number, number]>>> = {};
    let rsRiskLayers: Record<string, any> = {};
    let rsCarLayer: any = null;
    let rsCarPolygon: any = null;
    let rsVertexMarkers: any[] = [];
    let rsEditedNodes: Record<string, Set<number>> = {};

    let rsHistoryStack: string[] = [];
    let rsHistoryIndex = -1;
    let rsCurrentExportName = 'exportacao.txt';
    let rsInputTimeout: any = null;

    const $ = (id: string) =>
      containerRootRef.current?.querySelector(`#${id}`) as HTMLElement | null;

    // Função Universal Assíncrona para Forçar o Prompt "Salvar Como" do Windows
    async function rsSalvarArquivoComPrompt(
      conteudo: Blob | string,
      nomeSugerido: string,
      tipoMime: string,
      extensoes: string[]
    ) {
      const win = window as any;
      if ('showSaveFilePicker' in win) {
        try {
          const options = {
            suggestedName: nomeSugerido,
            types: [
              {
                description: 'Arquivos do Projeto Geodésico',
                accept: { [tipoMime]: extensoes },
              },
            ],
          };
          const handle = await win.showSaveFilePicker(options);
          const writable = await handle.createWritable();
          await writable.write(conteudo);
          await writable.close();
          return true;
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            console.error('Erro ao salvar arquivo via API:', err);
          } else {
            return false;
          }
        }
      }

      const blob =
        conteudo instanceof Blob
          ? conteudo
          : new Blob([conteudo], { type: tipoMime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeSugerido;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }

    const inicializarMotor = async () => {
      const { L, turf } = await garantirBibliotecasGeodesicas();
      if (cancelado || !L || !containerRootRef.current) return;

      const mapEl = $('rs-map-render');
      if (!mapEl) return;

      rsMap = L.map(mapEl).setView([-3.67, -45.38], 13);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 22,
          maxNativeZoom: 17,
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, e comunidade GIS',
        }
      ).addTo(rsMap);

      setTimeout(() => {
        if (rsMap) rsMap.invalidateSize();
      }, 250);

      function rsUpdateHistoryButtons() {
        const btnUndo = $('rs-btn-undo') as HTMLButtonElement | null;
        const btnRedo = $('rs-btn-redo') as HTMLButtonElement | null;
        if (btnUndo) btnUndo.disabled = rsHistoryIndex <= 0;
        if (btnRedo)
          btnRedo.disabled = rsHistoryIndex >= rsHistoryStack.length - 1;
      }

      function rsSaveState() {
        if (rsHistoryIndex < rsHistoryStack.length - 1) {
          rsHistoryStack = rsHistoryStack.slice(0, rsHistoryIndex + 1);
        }
        rsHistoryStack.push(JSON.stringify(rsGlebasData));
        rsHistoryIndex++;
        rsUpdateHistoryButtons();
      }

      function rsRefreshAllGeometries() {
        rsUpdateHistoryButtons();
        Object.keys(rsLayersGroup).forEach((k) => rsRedrawPolygon(k));
        rsUpdateGlebaInterface(rsActiveGlebaEdit);
      }

      function rsUndo() {
        if (rsHistoryIndex > 0) {
          rsHistoryIndex--;
          rsGlebasData = JSON.parse(rsHistoryStack[rsHistoryIndex]);
          rsRefreshAllGeometries();
        }
      }

      function rsRedo() {
        if (rsHistoryIndex < rsHistoryStack.length - 1) {
          rsHistoryIndex++;
          rsGlebasData = JSON.parse(rsHistoryStack[rsHistoryIndex]);
          rsRefreshAllGeometries();
        }
      }

      function rsFitSelectedGlebas() {
        const activeLayers: any[] = [];
        Object.keys(rsLayersGroup).forEach((key) => {
          if (rsLayersGroup[key]) activeLayers.push(rsLayersGroup[key]);
        });
        if (activeLayers.length > 0 && rsMap) {
          const group = L.featureGroup(activeLayers);
          rsMap.fitBounds(group.getBounds());
        }
      }

      function rsSyncTextAndOverlay(gleba: string | null) {
        const textarea = $('rs-coords-input') as HTMLTextAreaElement | null;
        const overlay = $('rs-coords-overlay');
        if (!textarea || !overlay || !gleba || !rsGlebasData[gleba]) return;

        const rawText: string[] = [];
        const overlayHTML: string[] = [];

        rsGlebasData[gleba].forEach((coord, i) => {
          const lineStr = `${coord[0].toFixed(10)}, ${coord[1].toFixed(10)}, ${
            coord[2]
          }`;
          rawText.push(lineStr);

          if (rsEditedNodes[gleba] && rsEditedNodes[gleba].has(i)) {
            overlayHTML.push(
              `<span>${lineStr}</span><span class="rs-edit-badge">📌 EDITADO</span>`
            );
          } else {
            overlayHTML.push(`<span>${lineStr}</span>`);
          }
        });

        textarea.value = rawText.join('\n');
        overlay.innerHTML = overlayHTML.join('<br>');
      }

      function rsRedrawPolygon(gleba: string) {
        if (!rsMap) return;
        if (rsLayersGroup[gleba]) {
          rsMap.removeLayer(rsLayersGroup[gleba]);
          delete rsLayersGroup[gleba];
        }

        const coords = rsGlebasData[gleba];
        if (!rsGlebasColors[gleba]) rsUpdateGlebaInterface();
        const cor = rsGlebasColors[gleba] || '#00A550';

        if (coords && coords.length > 0) {
          const leafletCoords = coords.map((c) => [c[0], c[1]]);
          const btnDraw = $('rs-btn-draw-mode');
          const isDrawing =
            btnDraw &&
            btnDraw.dataset.drawing === 'true' &&
            rsActiveGlebaEdit === gleba;

          let isClosedMath = false;
          if (coords.length > 2) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] === last[0] && first[1] === last[1]) {
              isClosedMath = true;
            }
          }

          if (coords.length === 1) {
            rsLayersGroup[gleba] = L.circleMarker(leafletCoords[0], {
              color: cor,
              radius: 6,
              fillColor: cor,
              fillOpacity: 0.7,
            }).addTo(rsMap);
          } else if (isDrawing && !isClosedMath) {
            rsLayersGroup[gleba] = L.polyline(leafletCoords, {
              color: cor,
              weight: 4,
            }).addTo(rsMap);
          } else {
            rsLayersGroup[gleba] = L.polygon(leafletCoords, {
              color: cor,
              fillColor: cor,
              fillOpacity: 0.35,
              weight: 3,
            }).addTo(rsMap);
          }
        }
      }

      function rsDrawEditNodes(gleba: string | null) {
        if (!rsMap) return;
        rsVertexMarkers.forEach((m) => rsMap.removeLayer(m));
        rsVertexMarkers = [];

        if (!gleba || !rsGlebasData[gleba] || rsGlebasData[gleba].length === 0)
          return;
        if (!rsLayersGroup[gleba]) return;

        const btn = $('rs-btn-activate-edit');
        if (!btn || btn.dataset.active !== 'true') return;

        const rawCoords = rsGlebasData[gleba];
        const cleanCoords = [rawCoords[0]];
        for (let i = 1; i < rawCoords.length; i++) {
          const prev = cleanCoords[cleanCoords.length - 1];
          const curr = rawCoords[i];
          if (prev[0] !== curr[0] || prev[1] !== curr[1]) {
            cleanCoords.push(curr);
          }
        }
        rsGlebasData[gleba] = cleanCoords;

        if (!rsEditedNodes[gleba]) rsEditedNodes[gleba] = new Set();

        const coords = rsGlebasData[gleba];
        const iconNormal = L.divIcon({
          className: 'rs-vertex-marker',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        const iconGhost = L.divIcon({
          className: 'rs-vertex-ghost',
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });

        coords.forEach((c, index) => {
          const marker = L.marker([c[0], c[1]], {
            icon: iconNormal,
            draggable: true,
          }).addTo(rsMap);

          marker.on('dragstart', () => rsSaveState());
          marker.on('drag', function (e: any) {
            const latlng = e.target.getLatLng();
            rsGlebasData[gleba][index][0] = latlng.lat;
            rsGlebasData[gleba][index][1] = latlng.lng;
            rsEditedNodes[gleba].add(index);
            const newLeafletCoords = rsGlebasData[gleba].map((coord) => [
              coord[0],
              coord[1],
            ]);
            if (rsLayersGroup[gleba] && rsLayersGroup[gleba].setLatLngs) {
              rsLayersGroup[gleba].setLatLngs(newLeafletCoords);
            }
            rsSyncTextAndOverlay(gleba);
          });

          marker.on('dragend', () => rsDrawEditNodes(gleba));

          marker.on('contextmenu', function () {
            rsSaveState();
            rsGlebasData[gleba].splice(index, 1);
            rsEditedNodes[gleba].clear();
            rsRedrawPolygon(gleba);
            rsDrawEditNodes(gleba);
            rsUpdateGlebaInterface(gleba);
          });

          marker.on('click', function () {
            const btnDraw = $('rs-btn-draw-mode');
            if (btnDraw && btnDraw.dataset.drawing === 'true') {
              if (index === 0 && rsGlebasData[gleba].length > 2) {
                rsSaveState();
                rsGlebasData[gleba].push([
                  rsGlebasData[gleba][0][0],
                  rsGlebasData[gleba][0][1],
                  rsGlebasData[gleba][0][2],
                ]);
                rsRedrawPolygon(gleba);
                rsDrawEditNodes(gleba);
                rsSyncTextAndOverlay(gleba);
              }
            }
          });

          rsVertexMarkers.push(marker);
        });

        if (coords.length >= 2) {
          for (let i = 0; i < coords.length; i++) {
            if (i === coords.length - 1 && coords.length === 2) break;
            const nextIndex = (i + 1) % coords.length;
            const midLat = (coords[i][0] + coords[nextIndex][0]) / 2;
            const midLng = (coords[i][1] + coords[nextIndex][1]) / 2;

            const ghost = L.marker([midLat, midLng], {
              icon: iconGhost,
              opacity: 0.6,
            }).addTo(rsMap);

            ghost.on('click', function () {
              rsSaveState();
              rsGlebasData[gleba].splice(nextIndex, 0, [midLat, midLng, 0.0]);
              rsEditedNodes[gleba].clear();
              rsRedrawPolygon(gleba);
              rsDrawEditNodes(gleba);
              rsUpdateGlebaInterface(gleba);
            });
            rsVertexMarkers.push(ghost);
          }
        }
      }

      function rsBindListEvents() {
        const root = containerRootRef.current;
        if (!root) return;

        root.querySelectorAll('.rs-layer-toggle').forEach((chk: any) => {
          chk.onchange = function () {
            const gleba = this.getAttribute('data-gleba');
            if (this.checked) {
              rsRedrawPolygon(gleba);
            } else {
              if (rsLayersGroup[gleba]) {
                rsMap.removeLayer(rsLayersGroup[gleba]);
                delete rsLayersGroup[gleba];
              }
              const btn = $('rs-btn-activate-edit');
              if (
                gleba === rsActiveGlebaEdit &&
                btn &&
                btn.dataset.active === 'true'
              ) {
                rsDrawEditNodes(gleba);
              }
            }
            rsFitSelectedGlebas();
          };
        });

        root.querySelectorAll('.rs-layer-color').forEach((picker: any) => {
          picker.oninput = function () {
            const gleba = this.getAttribute('data-gleba');
            rsGlebasColors[gleba] = this.value;
            if (rsLayersGroup[gleba] && rsLayersGroup[gleba].setStyle) {
              rsLayersGroup[gleba].setStyle({
                color: this.value,
                fillColor: this.value,
              });
            }
          };
        });

        root
          .querySelectorAll('.rs-edit-trigger, .rs-gleba-name-span')
          .forEach((el: any) => {
            el.onclick = function () {
              const gleba = this.getAttribute('data-gleba');
              rsUpdateGlebaInterface(gleba);
            };
          });

        root.querySelectorAll('.rs-rename-trigger').forEach((btn: any) => {
          btn.onclick = function () {
            const oldName = this.getAttribute('data-gleba');
            let newName = prompt(
              'Digite o novo nome para esta área:',
              oldName.toUpperCase()
            );
            if (!newName) return;
            newName = newName.trim().toLowerCase();
            if (newName === oldName) return;
            if (rsGlebasData[newName])
              return alert('Já existe uma área com este nome.');

            rsGlebasData[newName] = rsGlebasData[oldName];
            rsGlebasColors[newName] = rsGlebasColors[oldName];
            delete rsGlebasData[oldName];
            delete rsGlebasColors[oldName];

            if (rsLayersGroup[oldName]) {
              rsMap.removeLayer(rsLayersGroup[oldName]);
              delete rsLayersGroup[oldName];
            }

            if (rsActiveGlebaEdit === oldName) rsActiveGlebaEdit = newName;
            rsUpdateGlebaInterface(rsActiveGlebaEdit);
            rsRedrawPolygon(newName);
            rsFitSelectedGlebas();
          };
        });

        root.querySelectorAll('.rs-delete-trigger').forEach((btn: any) => {
          btn.onclick = function () {
            const gleba = this.getAttribute('data-gleba');
            if (
              confirm(`Excluir permanentemente a área ${gleba.toUpperCase()}?`)
            ) {
              delete rsGlebasData[gleba];
              delete rsGlebasColors[gleba];
              if (rsLayersGroup[gleba]) {
                rsMap.removeLayer(rsLayersGroup[gleba]);
                delete rsLayersGroup[gleba];
              }
              if (rsActiveGlebaEdit === gleba) rsActiveGlebaEdit = null;
              rsUpdateGlebaInterface(rsActiveGlebaEdit);
              rsFitSelectedGlebas();
            }
          };
        });
      }

      function rsUpdateGlebaInterface(mantemEditando: string | null = null) {
        const listGroup = $('rs-glebas-list-group');
        const titleSpan = $('rs-active-gleba-title');
        const btnActivate = $('rs-btn-activate-edit');
        const containerBotoes = $('rs-container-botoes-edit');
        const btnDraw = $('rs-btn-draw-mode');
        const coordsInput = $('rs-coords-input') as HTMLTextAreaElement | null;
        const coordsOverlay = $('rs-coords-overlay');

        if (!listGroup || !titleSpan || !btnActivate) return;
        listGroup.innerHTML = '';

        const glebas = Object.keys(rsGlebasData);
        if (glebas.length === 0) {
          listGroup.innerHTML =
            '<div style="font-size:0.8rem; color:#64748b; padding:8px; text-align:center;">Nenhuma gleba cadastrada...</div>';
          if (coordsInput) coordsInput.value = '';
          if (coordsOverlay) coordsOverlay.innerHTML = '';
          titleSpan.textContent = '[NENHUMA ÁREA SELECIONADA]';
          titleSpan.style.color = '#DC2626';
          if (containerBotoes) containerBotoes.style.display = 'none';
          rsActiveGlebaEdit = null;
          rsDrawEditNodes(null);
          return;
        }

        const coresPadrao = [
          '#00A550',
          '#004C27',
          '#D99700',
          '#2563eb',
          '#ea580c',
          '#9333ea',
          '#0284c7',
          '#b91c1c',
        ];

        glebas.forEach((gleba) => {
          if (!rsGlebasColors[gleba]) {
            rsGlebasColors[gleba] =
              coresPadrao[
                Object.keys(rsGlebasColors).length % coresPadrao.length
              ];
          }
          const isChecked = rsLayersGroup[gleba] ? 'checked' : '';
          const row = document.createElement('div');
          row.className = 'rs-gleba-item-row';
          if (rsActiveGlebaEdit === gleba) {
            row.style.borderColor = '#00A550';
          }
          row.innerHTML = `
            <input type="checkbox" class="rs-checkbox rs-layer-toggle" data-gleba="${gleba}" ${isChecked}>
            <input type="color" class="rs-color-picker rs-layer-color" data-gleba="${gleba}" value="${rsGlebasColors[gleba]}">
            <span class="rs-gleba-name-span" data-gleba="${gleba}">${gleba.toUpperCase()}</span>
            <button type="button" class="rs-mini-btn rs-edit-trigger" data-gleba="${gleba}" title="Editar Coordenadas">📝</button>
            <button type="button" class="rs-mini-btn rs-rename-trigger" data-gleba="${gleba}" title="Renomear">✏️</button>
            <button type="button" class="rs-mini-btn rs-delete-trigger" data-gleba="${gleba}" title="Excluir">🗑️</button>
          `;
          listGroup.appendChild(row);
        });

        if (mantemEditando && rsGlebasData[mantemEditando]) {
          rsActiveGlebaEdit = mantemEditando;
          rsSyncTextAndOverlay(mantemEditando);
          titleSpan.textContent = `- ${mantemEditando.toUpperCase()}`;
          titleSpan.style.color = '#00A550';
          if (containerBotoes) containerBotoes.style.display = 'flex';

          const isCurrentlyActive = btnActivate.dataset.active === 'true';
          if (isCurrentlyActive) {
            btnActivate.innerHTML = '✅ MODO DE AJUSTE ATIVO';
            btnActivate.style.backgroundColor = '#2563eb';
            btnActivate.style.color = '#ffffff';
          } else {
            btnActivate.innerHTML = '🗺️ AJUSTAR GEOMETRIA';
            btnActivate.style.backgroundColor = '#f1f5f9';
            btnActivate.style.color = '#475569';
            if (btnDraw) {
              btnDraw.dataset.drawing = 'false';
              btnDraw.style.backgroundColor = '#f1f5f9';
              btnDraw.style.borderColor = '#CBD5E1';
              btnDraw.style.boxShadow = 'none';
            }
          }
        } else {
          if (containerBotoes) containerBotoes.style.display = 'none';
        }

        rsBindListEvents();

        if (!mantemEditando) {
          rsDrawEditNodes(null);
        } else if (btnActivate.dataset.active === 'true') {
          rsDrawEditNodes(mantemEditando);
        }
      }

      function rsParseCoordinateLine(
        line: string
      ): [number, number, number] | null {
        let cleanLine = line.trim();
        if (!cleanLine) return null;
        cleanLine = cleanLine.replace(/\t/g, ' ');
        let parts = cleanLine.split(/[\s;]+/).filter((p) => p.length > 0);

        if (parts.length === 1 && cleanLine.includes(',')) {
          const commaCount = (cleanLine.match(/,/g) || []).length;
          if (commaCount >= 2 && !cleanLine.includes('.')) {
            const negatives = cleanLine.split(/(?=-)/);
            if (negatives.length >= 2) {
              parts = negatives.map((n) => n.replace(/,$/, '').trim());
            }
          } else {
            parts = cleanLine.split(',');
          }
        }

        const finalParts = parts
          .map((p) => {
            const item = p.trim().replace(/,/, '.').replace(/,/g, '');
            return parseFloat(item);
          })
          .filter((num) => !isNaN(num));

        if (finalParts.length >= 2) {
          return [
            finalParts[0],
            finalParts[1],
            finalParts[2] !== undefined ? finalParts[2] : 0.0,
          ];
        }
        return null;
      }

      function rsOpenExportModal(
        title: string,
        filename: string,
        content: string
      ) {
        const titleEl = $('rs-export-modal-title');
        const taEl = $('rs-export-textarea') as HTMLTextAreaElement | null;
        const modalEl = $('rs-export-modal');
        if (titleEl) titleEl.innerText = title;
        if (taEl) taEl.value = content;
        rsCurrentExportName = filename;
        if (modalEl) modalEl.classList.remove('rs-hidden');
      }

      function rsHighlightMarkerFromText() {
        const textarea = $('rs-coords-input') as HTMLTextAreaElement | null;
        const gleba = rsActiveGlebaEdit;
        if (!textarea || !gleba || !rsVertexMarkers) return;

        const cursorPosition = textarea.selectionStart;
        const textUpToCursor = textarea.value.substring(0, cursorPosition);
        const lineIndex = textUpToCursor.split('\n').length - 1;

        rsVertexMarkers.forEach((m) => {
          if (m.getElement()) {
            m.getElement().classList.remove('rs-vertex-marker-highlight');
          }
        });

        if (lineIndex >= 0 && lineIndex < rsVertexMarkers.length) {
          const marker = rsVertexMarkers[lineIndex];
          if (marker.getElement()) {
            marker.getElement().classList.add('rs-vertex-marker-highlight');
          }
        }
      }

      // =======================================================================
      // BINDING DE TODOS OS BOTÕES E INPUTS DA INTERFACE V4
      // =======================================================================
      const btnUndo = $('rs-btn-undo');
      const btnRedo = $('rs-btn-redo');
      if (btnUndo) btnUndo.onclick = () => rsUndo();
      if (btnRedo) btnRedo.onclick = () => rsRedo();

      const coordsInputEl = $('rs-coords-input') as HTMLTextAreaElement | null;
      const coordsOverlayEl = $('rs-coords-overlay');
      if (coordsInputEl && coordsOverlayEl) {
        coordsInputEl.onscroll = function () {
          coordsOverlayEl.scrollTop = coordsInputEl.scrollTop;
          coordsOverlayEl.scrollLeft = coordsInputEl.scrollLeft;
        };
        coordsInputEl.onkeyup = rsHighlightMarkerFromText;
        coordsInputEl.onclick = rsHighlightMarkerFromText;
        coordsInputEl.oninput = function (e: any) {
          if (!rsActiveGlebaEdit) return;
          clearTimeout(rsInputTimeout);
          rsInputTimeout = setTimeout(() => {
            rsSaveState();
            const lines = (e.target.value || '').split('\n');
            const validCoords: Array<[number, number, number]> = [];
            lines.forEach((l: string) => {
              const parsed = rsParseCoordinateLine(l);
              if (parsed) validCoords.push(parsed);
            });
            if (rsActiveGlebaEdit) {
              rsGlebasData[rsActiveGlebaEdit] = validCoords;
              rsRedrawPolygon(rsActiveGlebaEdit);
              const chk = containerRootRef.current?.querySelector(
                `.rs-layer-toggle[data-gleba="${rsActiveGlebaEdit}"]`
              ) as HTMLInputElement | null;
              if (chk && !chk.checked) chk.checked = true;
              if (validCoords.length > 0) rsFitSelectedGlebas();
            }
          }, 400);
        };
      }

      // Export Modal Buttons
      const btnModalCopy = $('rs-btn-modal-copy');
      if (btnModalCopy) {
        btnModalCopy.onclick = () => {
          const ta = $('rs-export-textarea') as HTMLTextAreaElement | null;
          if (!ta) return;
          ta.select();
          navigator.clipboard.writeText(ta.value).then(() => {
            alert(
              '📋 Conteúdo copiado para a área de transferência com sucesso!'
            );
          });
        };
      }

      const btnModalDown = $('rs-btn-modal-download');
      if (btnModalDown) {
        btnModalDown.onclick = async () => {
          const ta = $('rs-export-textarea') as HTMLTextAreaElement | null;
          if (!ta) return;
          await rsSalvarArquivoComPrompt(
            ta.value,
            rsCurrentExportName,
            'text/plain',
            ['.txt']
          );
        };
      }

      // Botão Extrair para GLEBAS (TXT)
      const btnExtractGlebas = $('rs-btn-extract-glebas');
      if (btnExtractGlebas) {
        btnExtractGlebas.onclick = (e) => {
          e.preventDefault();
          let textOutput = '';
          let hasData = false;
          let areaIndex = 1;
          Object.keys(rsGlebasData).forEach((gleba) => {
            if (rsGlebasData[gleba].length > 0) {
              hasData = true;
              rsGlebasData[gleba].forEach((c, pointIndex) => {
                const latFormatada = c[0].toFixed(10).replace('.', ',');
                const lonFormatada = c[1].toFixed(10).replace('.', ',');
                textOutput += `${areaIndex}\t${
                  pointIndex + 1
                }\t${latFormatada}\t${lonFormatada}\n`;
              });
              areaIndex++;
            }
          });
          if (!hasData)
            return alert('Nenhuma coordenada em memória para extrair.');
          rsOpenExportModal(
            '🚜 Exportação Padrão GLEBAS (TXT)',
            'IMPORTACAO_GLEBAS.txt',
            textOutput
          );
        };
      }

      // Botão Extrair Apenas Coordenadas
      const btnExtract = $('rs-btn-extract');
      if (btnExtract) {
        btnExtract.onclick = (e) => {
          e.preventDefault();
          let textOutput = '';
          let hasData = false;
          Object.keys(rsGlebasData).forEach((gleba) => {
            if (rsGlebasData[gleba].length > 0) {
              hasData = true;
              textOutput += `=== ÁREA: ${gleba.toUpperCase()} ===\n`;
              rsGlebasData[gleba].forEach((c) => {
                textOutput += `${c[0].toFixed(10)}, ${c[1].toFixed(10)}, ${
                  c[2]
                }\n`;
              });
              textOutput += `\n`;
            }
          });
          if (!hasData)
            return alert('Nenhuma coordenada em memória para extrair.');
          rsOpenExportModal(
            '📊 Coordenadas Brutas do Projeto',
            'COORDENADAS_BRUTAS.txt',
            textOutput
          );
        };
      }

      // Botão Excel Planilha de Coordenadas (.XLSX)
      const btnExtractXls = $('rs-btn-extract-xls');
      if (btnExtractXls) {
        btnExtractXls.onclick = async (e) => {
          e.preventDefault();
          let hasData = false;
          Object.keys(rsGlebasData).forEach((g) => {
            if (rsGlebasData[g].length > 0) hasData = true;
          });
          if (!hasData)
            return alert('Erro: Nenhuma coordenada em memória para exportar.');

          const ws_data: any[][] = [
            [
              'Cultura',
              'Formato da Gleba',
              'Area Nao Cultivada',
              'Gleba',
              'Ponto',
              'Lat',
              'Long',
              'Alt',
            ],
          ];
          Object.keys(rsGlebasData).forEach((glebaName) => {
            const coords = rsGlebasData[glebaName];
            if (coords.length > 0) {
              const culturaName = glebaName.toUpperCase();
              coords.forEach((c, index) => {
                ws_data.push([
                  culturaName,
                  'Formatos Diversos',
                  '0,00',
                  culturaName,
                  index + 1,
                  c[0],
                  c[1],
                  c[2] || 0,
                ]);
              });
            }
          });

          const ws = XLSX.utils.aoa_to_sheet(ws_data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Coordenadas');
          const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          await rsSalvarArquivoComPrompt(
            blob,
            'PLANILHA_COORDENADAS_GEODESICAS.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ['.xlsx']
          );
        };
      }

      // Botão Baixar Novo KML
      const btnDownloadNew = $('rs-btn-download-new');
      if (btnDownloadNew) {
        btnDownloadNew.onclick = async () => {
          let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>PROJETO RURAL</name> `;
          let fixedAuto = false;

          Object.keys(rsGlebasData).forEach((gleba) => {
            const coords = rsGlebasData[gleba];
            if (coords && coords.length >= 3) {
              const first = coords[0];
              const last = coords[coords.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                coords.push([first[0], first[1], first[2] || 0.0]);
                fixedAuto = true;
              }
            }
          });

          if (fixedAuto) {
            alert(
              '🔧 O sistema detectou polígonos abertos e os fechou automaticamente para o download.'
            );
            Object.keys(rsGlebasData).forEach((k) => rsRedrawPolygon(k));
            if (rsActiveGlebaEdit) rsSyncTextAndOverlay(rsActiveGlebaEdit);
          }

          Object.keys(rsGlebasData).forEach((gleba) => {
            if (rsGlebasData[gleba].length > 0) {
              const coordsStr = rsGlebasData[gleba]
                .map((c) => `${c[1]},${c[0]},${c[2]}`)
                .join(' ');
              kmlContent += `\n    <Placemark>\n      <name>${gleba.toUpperCase()}</name>\n      <Polygon>\n        <tessellate>1</tessellate>\n        <outerBoundaryIs>\n          <LinearRing>\n            <coordinates>${coordsStr}</coordinates>\n          </LinearRing>\n        </outerBoundaryIs>\n      </Polygon>\n    </Placemark>`;
            }
          });
          kmlContent += `\n  </Document>\n</kml>`;

          await rsSalvarArquivoComPrompt(
            kmlContent,
            'NOVO_PROJETO.kml',
            'application/vnd.google-earth.kml+xml',
            ['.kml']
          );
        };
      }

      // Importação de KML do Projeto
      const fileKmlInput = $('rs-file-kml') as HTMLInputElement | null;
      if (fileKmlInput) {
        fileKmlInput.onchange = async function (e: any) {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const placemarks = xmlDoc.getElementsByTagName('Placemark');

          let errorsFound = false;
          const logMessages: string[] = [];

          rsSaveState();
          rsGlebasData = {};
          Object.keys(rsLayersGroup).forEach((k) =>
            rsMap.removeLayer(rsLayersGroup[k])
          );
          rsLayersGroup = {};

          for (let i = 0; i < placemarks.length; i++) {
            const nameTag = placemarks[i].getElementsByTagName('name')[0];
            const rawName = nameTag
              ? (nameTag.textContent || '').trim().toLowerCase()
              : `area_${i + 1}`;
            if (!rsGlebasData[rawName]) rsGlebasData[rawName] = [];

            const coordsTags =
              placemarks[i].getElementsByTagName('coordinates');
            for (let j = 0; j < coordsTags.length; j++) {
              const coordsText = (coordsTags[j].textContent || '').trim();
              const coordsArray = coordsText
                .split(/\s+/)
                .filter((c) => c.length > 0);

              if (coordsArray.length > 0) {
                const firstPoint = coordsArray[0].trim();
                const lastPoint = coordsArray[coordsArray.length - 1].trim();
                if (firstPoint !== lastPoint) {
                  errorsFound = true;
                  logMessages.push(
                    `⚠️ Gleba '${rawName.toUpperCase()}': Polígono aberto corrigido.`
                  );
                  coordsArray.push(firstPoint);
                }

                const validCoords: Array<[number, number, number]> = [];
                coordsArray.forEach((coord) => {
                  const parts = coord.split(',');
                  if (parts.length >= 2) {
                    const lon = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    const alt = parts[2] ? parseFloat(parts[2]) : 0.0;
                    if (!isNaN(lat) && !isNaN(lon)) {
                      validCoords.push([lat, lon, alt]);
                    }
                  }
                });
                rsGlebasData[rawName] = validCoords;
              }
            }
            rsRedrawPolygon(rawName);
          }

          if (errorsFound) {
            alert(
              '⚠️ O arquivo KML importado continha polígonos abertos.\n\n' +
                logMessages.join('\n') +
                '\n\nO sistema já corrigiu internamente para você.'
            );
          } else {
            alert(
              '✅ Arquivo KML analisado. Todos os polígonos estão perfeitos.'
            );
          }

          $('rs-glebas-container')?.classList.remove('rs-hidden');
          rsUpdateGlebaInterface(Object.keys(rsGlebasData)[0] || null);
          containerRootRef.current
            ?.querySelectorAll('.rs-layer-toggle')
            .forEach((chk: any) => {
              chk.checked = true;
            });
          rsFitSelectedGlebas();
          e.target.value = '';
        };
      }

      // Importação de CSV
      const fileCsvInput = $('rs-file-csv') as HTMLInputElement | null;
      if (fileCsvInput) {
        fileCsvInput.onchange = async function (e: any) {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const lines = text.split('\n');
          if (lines.length < 2) return alert('Arquivo CSV vazio ou inválido.');

          const headers = lines[0].toLowerCase().split(',');
          let idxCultura = headers.findIndex(
            (h) =>
              h.includes('cultura') || h.includes('gleba') || h.includes('nome')
          );
          let idxLat = headers.findIndex((h) => h.includes('lat'));
          let idxLon = headers.findIndex(
            (h) => h.includes('long') || h.includes('lon')
          );
          let idxAlt = headers.findIndex((h) => h.includes('alt'));

          if (idxCultura === -1) idxCultura = 0;
          if (idxLat === -1) idxLat = 5;
          if (idxLon === -1) idxLon = 6;
          if (idxAlt === -1) idxAlt = 7;

          rsSaveState();
          rsGlebasData = {};
          Object.keys(rsLayersGroup).forEach((k) =>
            rsMap.removeLayer(rsLayersGroup[k])
          );
          rsLayersGroup = {};

          for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(',');
            if (columns.length > idxLon) {
              const rawCultura = columns[idxCultura]
                ? columns[idxCultura].trim().toLowerCase()
                : 'area_desconhecida';
              const lat = parseFloat(columns[idxLat].trim().replace(/,/, '.'));
              const lon = parseFloat(columns[idxLon].trim().replace(/,/, '.'));
              const alt = columns[idxAlt]
                ? parseFloat(columns[idxAlt].trim().replace(/,/, '.'))
                : 0;

              if (!isNaN(lat) && !isNaN(lon)) {
                if (!rsGlebasData[rawCultura]) rsGlebasData[rawCultura] = [];
                rsGlebasData[rawCultura].push([lat, lon, isNaN(alt) ? 0 : alt]);
              }
            }
          }

          Object.keys(rsGlebasData).forEach((k) => rsRedrawPolygon(k));
          $('rs-glebas-container')?.classList.remove('rs-hidden');
          rsUpdateGlebaInterface(Object.keys(rsGlebasData)[0] || null);
          containerRootRef.current
            ?.querySelectorAll('.rs-layer-toggle')
            .forEach((chk: any) => {
              chk.checked = true;
            });
          rsFitSelectedGlebas();
          alert('✅ Planilha CSV interpretada e importada perfeitamente!');
          e.target.value = '';
        };
      }

      // Importação de Excel (.XLS / .XLSX)
      const fileExcelInput = $('rs-file-excel') as HTMLInputElement | null;
      if (fileExcelInput) {
        fileExcelInput.onchange = function (e: any) {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function (ev: any) {
            const data = new Uint8Array(ev.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json: any[][] = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
            });

            if (json.length < 2)
              return alert('A planilha parece estar vazia ou inválida.');

            const headers = (json[0] || []).map((h) => String(h).toLowerCase());
            let idxCultura = headers.findIndex(
              (h) =>
                h.includes('cultura') ||
                h.includes('gleba') ||
                h.includes('nome')
            );
            let idxLat = headers.findIndex((h) => h.includes('lat'));
            let idxLon = headers.findIndex(
              (h) => h.includes('long') || h.includes('lon')
            );
            let idxAlt = headers.findIndex((h) => h.includes('alt'));

            if (idxCultura === -1) idxCultura = 0;
            if (idxLat === -1) idxLat = 5;
            if (idxLon === -1) idxLon = 6;
            if (idxAlt === -1) idxAlt = 7;

            rsSaveState();
            rsGlebasData = {};
            Object.keys(rsLayersGroup).forEach((k) =>
              rsMap.removeLayer(rsLayersGroup[k])
            );
            rsLayersGroup = {};

            for (let i = 1; i < json.length; i++) {
              const row = json[i];
              if (!row || row.length === 0) continue;
              if (
                row.length > idxLon &&
                row[idxLat] !== undefined &&
                row[idxLon] !== undefined
              ) {
                const rawCultura = row[idxCultura]
                  ? String(row[idxCultura]).trim().toLowerCase()
                  : 'area_desconhecida';
                const lat = parseFloat(
                  String(row[idxLat]).trim().replace(/,/, '.')
                );
                const lon = parseFloat(
                  String(row[idxLon]).trim().replace(/,/, '.')
                );
                const alt = row[idxAlt]
                  ? parseFloat(String(row[idxAlt]).trim().replace(/,/, '.'))
                  : 0;

                if (!isNaN(lat) && !isNaN(lon)) {
                  if (!rsGlebasData[rawCultura]) rsGlebasData[rawCultura] = [];
                  rsGlebasData[rawCultura].push([
                    lat,
                    lon,
                    isNaN(alt) ? 0 : alt,
                  ]);
                }
              }
            }

            Object.keys(rsGlebasData).forEach((k) => rsRedrawPolygon(k));
            $('rs-glebas-container')?.classList.remove('rs-hidden');
            rsUpdateGlebaInterface(Object.keys(rsGlebasData)[0] || null);
            containerRootRef.current
              ?.querySelectorAll('.rs-layer-toggle')
              .forEach((chk: any) => {
                chk.checked = true;
              });
            rsFitSelectedGlebas();
            alert(
              '✅ Planilha Excel (.XLS / .XLSX) lida e importada com sucesso!'
            );
          };
          reader.readAsArrayBuffer(file);
          e.target.value = '';
        };
      }

      // Importação de Áreas de Risco (Farmcheck)
      const fileFarmcheck = $('rs-file-farmcheck') as HTMLInputElement | null;
      if (fileFarmcheck) {
        fileFarmcheck.onchange = async function (e: any) {
          const files = e.target.files;
          if (!files || files.length === 0) return;

          const riskList = $('rs-risk-list-group');
          if (riskList && Object.keys(rsRiskData).length === 0) {
            riskList.innerHTML = '';
          }

          for (let f = 0; f < files.length; f++) {
            const file = files[f];
            const text = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            const placemarks = xmlDoc.getElementsByTagName('Placemark');

            const typeName = file.name
              .replace(/\.kml$/i, '')
              .trim()
              .toUpperCase();
            if (rsRiskLayers[typeName]) {
              rsMap.removeLayer(rsRiskLayers[typeName]);
              delete rsRiskLayers[typeName];
            }
            rsRiskData[typeName] = [];

            let hasGeometry = false;
            for (let i = 0; i < placemarks.length; i++) {
              const coordsTags =
                placemarks[i].getElementsByTagName('coordinates');
              for (let j = 0; j < coordsTags.length; j++) {
                const coordsText = (coordsTags[j].textContent || '').trim();
                const coordsArray = coordsText
                  .split(/\s+/)
                  .filter((c) => c.length > 0);
                if (coordsArray.length >= 3) {
                  const validCoords: Array<[number, number, number]> = [];
                  coordsArray.forEach((coord) => {
                    const parts = coord.split(',');
                    if (parts.length >= 2) {
                      validCoords.push([
                        parseFloat(parts[1]),
                        parseFloat(parts[0]),
                        parts[2] ? parseFloat(parts[2]) : 0.0,
                      ]);
                    }
                  });
                  rsRiskData[typeName].push(validCoords);
                  hasGeometry = true;
                }
              }
            }

            if (hasGeometry && riskList) {
              const leafletPolyCoords = rsRiskData[typeName].map((poly) =>
                poly.map((c) => [c[0], c[1]])
              );
              rsRiskLayers[typeName] = L.polygon(leafletPolyCoords, {
                color: '#dc2626',
                fillColor: '#ef4444',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '5, 5',
              }).addTo(rsMap);

              const row = document.createElement('div');
              row.className = 'rs-gleba-item-row';
              row.style.borderLeft = '3px solid #dc2626';
              row.innerHTML = `
                <span style="font-size:0.8rem; font-weight:600; color:#b91c1c; flex:1;">🚫 ${typeName}</span>
                <button type="button" class="rs-mini-btn" title="Remover Restrição">🗑️</button>
              `;
              const btnRem = row.querySelector('button');
              if (btnRem) {
                btnRem.onclick = () => {
                  if (rsRiskLayers[typeName]) {
                    rsMap.removeLayer(rsRiskLayers[typeName]);
                    delete rsRiskLayers[typeName];
                  }
                  delete rsRiskData[typeName];
                  row.remove();
                  if (Object.keys(rsRiskData).length === 0) {
                    riskList.innerHTML =
                      '<div style="font-size:0.8rem; color:#94a3b8; padding:4px; text-align:center;">Nenhuma restrição importada...</div>';
                  }
                };
              }
              riskList.appendChild(row);
            }
          }

          const activeRiskLayers = Object.values(rsRiskLayers);
          if (activeRiskLayers.length > 0) {
            const group = L.featureGroup(activeRiskLayers);
            rsMap.fitBounds(group.getBounds());
          }
          alert(
            '✅ Arquivos do Farmcheck carregados e mapeados como Áreas de Risco!'
          );
          e.target.value = '';
        };
      }

      // Auto-Correção de Sobreposições (Turf.js Difference com buffer de 1m)
      const btnAutoFix = $('rs-btn-auto-fix') as HTMLButtonElement | null;
      if (btnAutoFix) {
        btnAutoFix.onclick = (e) => {
          e.preventDefault();
          const glebaKeys = Object.keys(rsGlebasData);
          const riskKeys = Object.keys(rsRiskData);

          if (glebaKeys.length === 0)
            return alert(
              'Erro: Carregue ou desenhe primeiro as glebas do projeto para executar a correção.'
            );
          if (riskKeys.length === 0)
            return alert(
              'Erro: Importe ao menos uma área de risco (APP/Reserva) do Farmcheck para realizar o cruzamento.'
            );

          const originalText = btnAutoFix.innerHTML;
          btnAutoFix.innerHTML = '⏳ Processando Álgebra Espacial...';
          btnAutoFix.style.backgroundColor = '#94a3b8';
          btnAutoFix.disabled = true;

          setTimeout(() => {
            rsSaveState();
            let totalModificadas = 0;
            const logDetalhamento: string[] = [];

            glebaKeys.forEach((glebaName) => {
              const projectCoords = rsGlebasData[glebaName];
              if (!projectCoords || projectCoords.length < 3) return;

              const turfProjectCoords = projectCoords.map((c) => [c[1], c[0]]);
              if (
                turfProjectCoords[0][0] !==
                  turfProjectCoords[turfProjectCoords.length - 1][0] ||
                turfProjectCoords[0][1] !==
                  turfProjectCoords[turfProjectCoords.length - 1][1]
              ) {
                turfProjectCoords.push([
                  turfProjectCoords[0][0],
                  turfProjectCoords[0][1],
                ]);
              }

              let projectPolygon: any = turf.polygon([turfProjectCoords]);
              let mudouGleba = false;
              const restricoesAtingidas: string[] = [];

              riskKeys.forEach((riskName) => {
                const riskPolygonsList = rsRiskData[riskName];
                riskPolygonsList.forEach((riskCoords) => {
                  if (riskCoords.length < 3 || !projectPolygon) return;
                  const turfRiskCoords = riskCoords.map((c) => [c[1], c[0]]);
                  if (
                    turfRiskCoords[0][0] !==
                      turfRiskCoords[turfRiskCoords.length - 1][0] ||
                    turfRiskCoords[0][1] !==
                      turfRiskCoords[turfRiskCoords.length - 1][1]
                  ) {
                    turfRiskCoords.push([
                      turfRiskCoords[0][0],
                      turfRiskCoords[0][1],
                    ]);
                  }

                  const riskPolygon = turf.polygon([turfRiskCoords]);
                  try {
                    const intersection = turf.intersect(
                      projectPolygon,
                      riskPolygon
                    );
                    if (intersection) {
                      const MARGEM_SEGURANCA_KM = 0.001;
                      const riskPolygonExpandido = turf.buffer(
                        riskPolygon,
                        MARGEM_SEGURANCA_KM,
                        { units: 'kilometers' }
                      );
                      const difference = turf.difference(
                        projectPolygon,
                        riskPolygonExpandido
                      );
                      projectPolygon = difference ? difference : null;
                      mudouGleba = true;
                      if (!restricoesAtingidas.includes(riskName))
                        restricoesAtingidas.push(riskName);
                    }
                  } catch (err) {
                    console.error('Erro topográfico no cruzamento:', err);
                  }
                });
              });

              if (mudouGleba) {
                totalModificadas++;
                logDetalhamento.push(
                  `- Gleba '${glebaName.toUpperCase()}' invadia: ${restricoesAtingidas.join(
                    ', '
                  )}`
                );
                if (projectPolygon === null) {
                  rsGlebasData[glebaName] = [];
                } else {
                  let newCoords: Array<[number, number, number]> = [];
                  if (projectPolygon.geometry.type === 'Polygon') {
                    newCoords = projectPolygon.geometry.coordinates[0].map(
                      (c: number[]) => [c[1], c[0], 0.0]
                    );
                  } else if (projectPolygon.geometry.type === 'MultiPolygon') {
                    newCoords = projectPolygon.geometry.coordinates[0][0].map(
                      (c: number[]) => [c[1], c[0], 0.0]
                    );
                    logDetalhamento.push(
                      `  ⚠️ ALERTA: A área foi dividida ao meio pelo recorte. O sistema manteve apenas o fragmento principal.`
                    );
                  }
                  rsGlebasData[glebaName] = newCoords;
                }
                rsRedrawPolygon(glebaName);
              }
            });

            btnAutoFix.innerHTML = originalText;
            btnAutoFix.style.backgroundColor = '#004C27';
            btnAutoFix.disabled = false;

            if (totalModificadas > 0) {
              rsUpdateGlebaInterface(
                rsActiveGlebaEdit || Object.keys(rsGlebasData)[0]
              );
              rsFitSelectedGlebas();
              alert(
                `🎯 SUCESSO! Recorte Geoespacial Concluído.\n\nO sistema corrigiu ${totalModificadas} área(s) do projeto:\n${logDetalhamento.join(
                  '\n'
                )}\n\nO novo traçado seguro já está no mapa e pronto para download.`
              );
            } else {
              alert(
                `✅ ANÁLISE CONCLUÍDA: 100% LEGAL.\n\nO motor cruzou as ${glebaKeys.length} gleba(s) do projeto contra ${riskKeys.length} arquivo(s) de restrição.\n\nRESULTADO: Nenhuma sobreposição ou invasão detectada.`
              );
            }
          }, 100);
        };
      }

      // Importação do Limite do CAR Oficial
      const fileCar = $('rs-file-car') as HTMLInputElement | null;
      if (fileCar) {
        fileCar.onchange = async function (e: any) {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const placemarks = xmlDoc.getElementsByTagName('Placemark');

          const validCoords: Array<Array<[number, number]>> = [];
          for (let i = 0; i < placemarks.length; i++) {
            const coordsTags =
              placemarks[i].getElementsByTagName('coordinates');
            for (let j = 0; j < coordsTags.length; j++) {
              const coordsText = (coordsTags[j].textContent || '').trim();
              const coordsArray = coordsText
                .split(/\s+/)
                .filter((c) => c.length > 0);
              if (coordsArray.length >= 3) {
                const polyRing: Array<[number, number]> = [];
                coordsArray.forEach((coord) => {
                  const parts = coord.split(',');
                  if (parts.length >= 2) {
                    polyRing.push([parseFloat(parts[0]), parseFloat(parts[1])]);
                  }
                });
                if (
                  polyRing[0][0] !== polyRing[polyRing.length - 1][0] ||
                  polyRing[0][1] !== polyRing[polyRing.length - 1][1]
                ) {
                  polyRing.push([...polyRing[0]]);
                }
                validCoords.push(polyRing);
              }
            }
          }

          if (validCoords.length > 0) {
            if (rsCarLayer) rsMap.removeLayer(rsCarLayer);
            rsCarPolygon = turf.polygon([validCoords[0]]);
            const leafletCoords = validCoords[0].map((c) => [c[1], c[0]]);
            rsCarLayer = L.polygon(leafletCoords, {
              color: '#2563eb',
              fillColor: 'transparent',
              weight: 3,
              dashArray: '8, 8',
            }).addTo(rsMap);

            rsMap.fitBounds(rsCarLayer.getBounds());
            const btnImportCar = $('rs-btn-import-car');
            if (btnImportCar) {
              btnImportCar.innerHTML = '✅ CAR OFICIAL CARREGADO';
              btnImportCar.style.backgroundColor = '#eff6ff';
            }
            alert(
              '🗺️ Limite do CAR importado com sucesso!\n\nO perímetro oficial está marcado em azul tracejado no mapa.'
            );
          } else {
            alert(
              '⚠️ Não foi possível extrair um perímetro válido deste arquivo KML do CAR.'
            );
          }
          e.target.value = '';
        };
      }

      // Enquadrar no CAR (Interseção com margem interna de -1m)
      const btnAutoFitCar = $('rs-btn-auto-fit-car');
      if (btnAutoFitCar) {
        btnAutoFitCar.onclick = () => {
          if (!rsCarPolygon) {
            return alert('⚠️ Por favor, importe o KML do CAR Oficial primeiro.');
          }
          if (
            !confirm(
              'Isso forçará todas as áreas cadastradas a ficarem estritamente dentro do limite do CAR, respeitando uma margem de segurança. Confirmar?'
            )
          )
            return;

          const MARGEM_INTERNA_KM = -0.001;
          const carEncolhido = turf.buffer(rsCarPolygon, MARGEM_INTERNA_KM, {
            units: 'kilometers',
          });
          let houveAjuste = false;

          Object.keys(rsGlebasData).forEach((gleba) => {
            const coords = rsGlebasData[gleba];
            if (coords && coords.length >= 3) {
              const polyCoords = coords.map((c) => [c[1], c[0]]);
              if (
                polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] ||
                polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1]
              ) {
                polyCoords.push([...polyCoords[0]]);
              }
              const glebaTurf = turf.polygon([polyCoords]);
              const intersecao = turf.intersect(glebaTurf, carEncolhido);
              if (intersecao) {
                rsSaveState();
                const novasCoordsTurf = intersecao.geometry.coordinates[0];
                rsGlebasData[gleba] = novasCoordsTurf.map((c: number[]) => [
                  c[1],
                  c[0],
                  0.0,
                ]);
                if (rsEditedNodes[gleba]) rsEditedNodes[gleba].clear();
                houveAjuste = true;
              }
            }
          });

          if (houveAjuste) {
            Object.keys(rsGlebasData).forEach((k) => rsRedrawPolygon(k));
            if (rsActiveGlebaEdit) rsSyncTextAndOverlay(rsActiveGlebaEdit);
            alert(
              '🎯 Áreas ajustadas! Todas as glebas foram enquadradas perfeitamente dentro do perímetro do CAR.'
            );
          } else {
            alert(
              'Nenhuma modificação foi necessária ou as glebas estão totalmente fora do CAR.'
            );
          }
        };
      }

      // Botões de Criar Manualmente, Adicionar Gleba, Marcar/Desmarcar Todas, Ajustar Geometria, Caneta e Limpar Tudo
      const btnNew = $('rs-btn-new');
      if (btnNew) {
        btnNew.onclick = (e) => {
          e.stopPropagation();
          $('rs-glebas-container')?.classList.remove('rs-hidden');
          if (rsMap) setTimeout(() => rsMap.invalidateSize(), 200);
        };
      }

      const btnAddGleba = $('rs-btn-add-gleba');
      if (btnAddGleba) {
        btnAddGleba.onclick = (e) => {
          e.preventDefault();
          const input = $('rs-new-gleba-name') as HTMLInputElement | null;
          if (!input) return;
          const name = input.value.trim().toLowerCase();
          if (name === '') return alert('Digite um nome para a gleba.');
          if (rsGlebasData[name]) return alert('Essa gleba já existe!');
          rsGlebasData[name] = [];
          input.value = '';
          rsUpdateGlebaInterface(name);
        };
      }

      const btnCheckAll = $('rs-btn-check-all');
      if (btnCheckAll) {
        btnCheckAll.onclick = (e) => {
          e.preventDefault();
          let changed = false;
          containerRootRef.current
            ?.querySelectorAll('.rs-layer-toggle')
            .forEach((chk: any) => {
              if (!chk.checked) {
                chk.checked = true;
                const gleba = chk.getAttribute('data-gleba');
                rsRedrawPolygon(gleba);
                changed = true;
              }
            });
          if (changed) rsFitSelectedGlebas();
        };
      }

      const btnUncheckAll = $('rs-btn-uncheck-all');
      if (btnUncheckAll) {
        btnUncheckAll.onclick = (e) => {
          e.preventDefault();
          containerRootRef.current
            ?.querySelectorAll('.rs-layer-toggle')
            .forEach((chk: any) => {
              if (chk.checked) {
                chk.checked = false;
                const gleba = chk.getAttribute('data-gleba');
                if (rsLayersGroup[gleba]) {
                  rsMap.removeLayer(rsLayersGroup[gleba]);
                  delete rsLayersGroup[gleba];
                }
              }
            });
        };
      }

      const btnActivateEdit = $('rs-btn-activate-edit');
      if (btnActivateEdit) {
        btnActivateEdit.onclick = function (e) {
          e.preventDefault();
          if (!rsActiveGlebaEdit) return;
          const checkbox = containerRootRef.current?.querySelector(
            `.rs-layer-toggle[data-gleba="${rsActiveGlebaEdit}"]`
          ) as HTMLInputElement | null;
          if (checkbox && !checkbox.checked) {
            alert(
              'Aviso: Ative o checkbox de exibição desta gleba na lista acima para poder ajustar a geometria no mapa.'
            );
            return;
          }

          if (btnActivateEdit.dataset.active === 'true') {
            btnActivateEdit.dataset.active = 'false';
            btnActivateEdit.innerHTML = '🗺️ Ajustar Geometria';
            btnActivateEdit.style.backgroundColor = '#f1f5f9';
            btnActivateEdit.style.color = '#475569';
            rsDrawEditNodes(null);
            const btnDraw = $('rs-btn-draw-mode');
            if (btnDraw) {
              btnDraw.dataset.drawing = 'false';
              btnDraw.style.backgroundColor = '#f1f5f9';
              btnDraw.style.borderColor = '#CBD5E1';
              btnDraw.style.boxShadow = 'none';
            }
          } else {
            btnActivateEdit.dataset.active = 'true';
            btnActivateEdit.innerHTML = '✅ Modo de Ajuste Ativo';
            btnActivateEdit.style.backgroundColor = '#004C27';
            btnActivateEdit.style.color = '#ffffff';
            rsDrawEditNodes(rsActiveGlebaEdit);
          }
        };
      }

      const btnDrawMode = $('rs-btn-draw-mode');
      if (btnDrawMode) {
        btnDrawMode.onclick = function (e) {
          e.preventDefault();
          const btnActivate = $('rs-btn-activate-edit');
          if (!btnActivate || btnActivate.dataset.active !== 'true') {
            alert(
              "Ative primeiro o modo 'Ajustar Geometria' para poder usar a caneta."
            );
            return;
          }
          if (btnDrawMode.dataset.drawing === 'false') {
            btnDrawMode.dataset.drawing = 'true';
            btnDrawMode.style.backgroundColor = '#fef3c7';
            btnDrawMode.style.borderColor = '#d97706';
            btnDrawMode.style.boxShadow =
              'inset 0 0 5px rgba(217, 119, 6, 0.3)';
          } else {
            btnDrawMode.dataset.drawing = 'false';
            btnDrawMode.style.backgroundColor = '#f1f5f9';
            btnDrawMode.style.borderColor = '#CBD5E1';
            btnDrawMode.style.boxShadow = 'none';
          }
          if (rsActiveGlebaEdit) rsRedrawPolygon(rsActiveGlebaEdit);
        };
      }

      // Escutador de clique no mapa para o Modo Caneta (com Ímã de 15 metros)
      rsMap.on('click', function (e: any) {
        const btnEdit = $('rs-btn-activate-edit');
        const btnDraw = $('rs-btn-draw-mode');
        if (
          rsActiveGlebaEdit &&
          btnEdit?.dataset.active === 'true' &&
          btnDraw?.dataset.drawing === 'true'
        ) {
          rsSaveState();
          let lat = e.latlng.lat;
          let lng = e.latlng.lng;
          if (!rsGlebasData[rsActiveGlebaEdit]) {
            rsGlebasData[rsActiveGlebaEdit] = [];
          }
          const glebaCoords = rsGlebasData[rsActiveGlebaEdit];
          if (glebaCoords.length > 2) {
            const firstPoint = L.latLng(glebaCoords[0][0], glebaCoords[0][1]);
            const distanciaMeters = rsMap.distance(e.latlng, firstPoint);
            if (distanciaMeters < 15) {
              lat = glebaCoords[0][0];
              lng = glebaCoords[0][1];
            }
          }
          rsGlebasData[rsActiveGlebaEdit].push([lat, lng, 0.0]);
          rsRedrawPolygon(rsActiveGlebaEdit);
          rsDrawEditNodes(rsActiveGlebaEdit);
          rsSyncTextAndOverlay(rsActiveGlebaEdit);
        }
      });

      // Botão Limpar Tudo
      const btnClear = $('rs-btn-clear');
      if (btnClear) {
        btnClear.onclick = (e) => {
          e.preventDefault();
          if (
            confirm(
              'Tem certeza que deseja limpar todos os dados do mapa e do painel?'
            )
          ) {
            rsGlebasData = {};
            rsGlebasColors = {};
            rsRiskData = {};
            rsEditedNodes = {};
            rsActiveGlebaEdit = null;
            rsCarPolygon = null;

            Object.keys(rsLayersGroup).forEach((k) =>
              rsMap.removeLayer(rsLayersGroup[k])
            );
            rsLayersGroup = {};
            Object.keys(rsRiskLayers).forEach((k) =>
              rsMap.removeLayer(rsRiskLayers[k])
            );
            rsRiskLayers = {};
            if (rsCarLayer) {
              rsMap.removeLayer(rsCarLayer);
              rsCarLayer = null;
            }
            rsDrawEditNodes(null);

            const titleEl = $('rs-active-gleba-title');
            if (titleEl) titleEl.textContent = '[NENHUMA ÁREA SELECIONADA]';
            if (coordsInputEl) coordsInputEl.value = '';
            if (coordsOverlayEl) coordsOverlayEl.innerHTML = '';
            $('rs-glebas-container')?.classList.add('rs-hidden');

            const listGrp = $('rs-glebas-list-group');
            if (listGrp)
              listGrp.innerHTML =
                '<div style="font-size:0.8rem; color:#64748b; padding:8px; text-align:center;">Nenhuma gleba cadastrada...</div>';
            const riskGrp = $('rs-risk-list-group');
            if (riskGrp)
              riskGrp.innerHTML =
                '<div style="font-size:0.8rem; color:#64748b; padding:4px; text-align:center;">Nenhuma restrição importada...</div>';

            const contBotoes = $('rs-container-botoes-edit');
            if (contBotoes) contBotoes.style.display = 'none';

            if (btnActivateEdit) {
              btnActivateEdit.dataset.active = 'false';
              btnActivateEdit.innerHTML = '🗺️ Ajustar Geometria';
              btnActivateEdit.style.backgroundColor = '#f1f5f9';
              btnActivateEdit.style.color = '#475569';
            }
            if (btnDrawMode) {
              btnDrawMode.dataset.drawing = 'false';
              btnDrawMode.style.backgroundColor = '#f1f5f9';
              btnDrawMode.style.borderColor = '#CBD5E1';
              btnDrawMode.style.boxShadow = 'none';
            }
            const btnImpCar = $('rs-btn-import-car');
            if (btnImpCar) {
              btnImpCar.innerHTML = '🗺️ IMPORTAR LIMITE DO CAR OFICIAL';
              btnImpCar.style.backgroundColor = '';
            }

            alert('✨ LIMPEZA CONCLUÍDA.');
          }
        };
      }

      rsSaveState();
    };

    inicializarMotor();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        ($('rs-btn-undo') as HTMLButtonElement | null)?.click();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        ($('rs-btn-redo') as HTMLButtonElement | null)?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelado = true;
      window.removeEventListener('keydown', handleKeyDown);
      if (rsMap) {
        try {
          rsMap.remove();
        } catch {
          // Ignora
        }
      }
    };
  }, [aberto]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={containerRootRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.78)',
        zIndex: 950000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <style>{`
        .rs-workspace-container {
          display: flex;
          gap: 0;
          width: 98vw;
          max-width: 1680px;
          height: 95vh;
          min-height: 650px;
          background-color: #FFFFFF;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.45);
        }
        .rs-panel {
          flex: 0 0 580px;
          background-color: #FFFFFF;
          padding: 16px 20px;
          border-right: 1px solid #CBD5E1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          box-sizing: border-box;
        }
        .rs-map-panel {
          flex: 1;
          position: relative;
          background-color: #E2E8F0;
        }
        #rs-map-render { width: 100%; height: 100%; z-index: 1; }
        .rs-card-module {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .rs-title {
          font-size: 1.05rem;
          color: #334155;
          margin: 0;
          font-weight: 800;
          text-transform: uppercase;
        }
        .rs-subtitle {
          font-size: 0.85rem;
          color: #334155;
          margin: 0 0 0.6rem 0;
          font-weight: 700;
          text-transform: uppercase;
        }
        .rs-divider { border: 0; height: 1px; background: #E2E8F0; margin: 0.85rem 0; }
        .rs-hidden { display: none !important; }
        .rs-flex-row { display: flex; gap: 8px; align-items: center; }
        .rs-flex-row .rs-input { flex: 1; }
        .rs-action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }
        .rs-btn {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.72rem;
          transition: all 0.15s ease;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
          background-color: #FFFFFF;
          color: #334155;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rs-btn:hover { background-color: #F3F4F6; border-color: #94A3B8; }
        .rs-btn-primary { border-left: 3px solid #004C27; }
        .rs-btn-primary:hover { background-color: #F0FDF4; border-color: #004C27; color: #004C27; }
        .rs-btn-success { border-left: 3px solid #00A550; }
        .rs-btn-success:hover { background-color: #F0FDF4; border-color: #00A550; color: #00A550; }
        .rs-btn-outline { border-left: 3px solid #64748B; }
        .rs-btn-danger { border-left: 3px solid #DC2626; }
        .rs-btn-danger:hover { background-color: #FEF2F2; border-color: #DC2626; color: #DC2626; }
        .rs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rs-full-width { grid-column: span 2; justify-content: center; text-align: center; margin-top: 4px; }
        .rs-input-group { margin-bottom: 1rem; }
        .rs-input-group label { display: block; font-size: 0.75rem; color: #334155; margin-bottom: 4px; font-weight: 600; }
        .rs-input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          font-size: 0.8rem;
          box-sizing: border-box;
          background-color: #FFFFFF;
        }
        .rs-textarea-container { position: relative; width: 100%; height: 140px; }
        .rs-textarea {
          width: 100%; height: 100%; padding: 8px 10px; border: 1px solid #CBD5E1; border-radius: 4px;
          font-family: 'Consolas', 'Courier New', monospace; font-size: 0.75rem; line-height: 1.5; box-sizing: border-box;
          background-color: #FFFFFF; white-space: pre; overflow: auto; resize: none; color: #334155;
        }
        .rs-textarea-overlay {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          padding: 8px 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.75rem; line-height: 1.5;
          border: 1px solid transparent; box-sizing: border-box; color: transparent; pointer-events: none; overflow: hidden; white-space: pre;
        }
        .rs-edit-badge {
          color: #DC2626; font-size: 0.65rem; font-weight: 700; background-color: #FEE2E2;
          padding: 1px 4px; border-radius: 3px; margin-left: 8px; font-family: 'Segoe UI', sans-serif;
          border: 1px solid #FCA5A5;
        }
        .rs-checklist-box {
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          background-color: #FFFFFF;
          max-height: 180px;
          overflow-y: auto;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .rs-gleba-item-row {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #F8FAFC;
          padding: 4px 8px;
          border-radius: 3px;
          border: 1px solid #E2E8F0;
        }
        .rs-checkbox { width: 14px; height: 14px; cursor: pointer; accent-color: #00A550; margin: 0; }
        .rs-gleba-name-span { flex: 1; font-size: 0.75rem; font-weight: 600; color: #334155; cursor: pointer; }
        .rs-color-picker { border: 1px solid #CBD5E1; width: 22px; height: 22px; padding: 0; background: transparent; cursor: pointer; border-radius: 3px; }
        .rs-mini-btn { width: auto; background: transparent; border: 1px solid transparent; cursor: pointer; padding: 2px 5px; font-size: 0.8rem; border-radius: 3px; color: #64748B; }
        .rs-mini-btn:hover { background: #E2E8F0; color: #334155; }
        .rs-vertex-marker { background-color: #FFFFFF; border: 2px solid #00A550; border-radius: 50%; cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .rs-vertex-ghost { background-color: rgba(255, 255, 255, 0.45); border: 1px dashed #64748B; border-radius: 50%; cursor: pointer; }
        .rs-vertex-marker-highlight {
          background-color: #D99700 !important;
          border: 3px solid #FFFFFF !important;
          transform: scale(1.4);
          box-shadow: 0 0 10px rgba(242, 169, 0, 0.8) !important;
        }
        .rs-hint { display: block; font-size: 0.7rem; color: #64748B; margin-top: 4px; font-weight: 500; }
      `}</style>

      <div id="rs-kml-workspace" className="rs-workspace-container">
        <aside id="rs-sidebar" className="rs-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #D99700',
              paddingBottom: '8px',
              marginBottom: '12px',
            }}
          >
            <div>
              <h2 className="rs-title">🗺️ Verificador de KML Geodésico</h2>
              <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                By: Reinaldo Trinta • Motor Geoespacial v4.0 (Leaflet + Turf.js)
              </span>
            </div>
            <button
              type="button"
              onClick={onFechar}
              style={{
                width: 'auto',
                padding: '5px 12px',
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ✖ Fechar
            </button>
          </div>

          <div className="rs-flex-row" style={{ marginBottom: '12px' }}>
            <button
              type="button"
              id="rs-btn-undo"
              className="rs-btn rs-btn-outline"
              style={{ flex: 1, justifyContent: 'center', padding: '7px' }}
              title="Desfazer (Ctrl+Z)"
              disabled
            >
              ↩️ Desfazer
            </button>
            <button
              type="button"
              id="rs-btn-redo"
              className="rs-btn rs-btn-outline"
              style={{ flex: 1, justifyContent: 'center', padding: '7px' }}
              title="Refazer (Ctrl+Y)"
              disabled
            >
              ↪️ Refazer
            </button>
          </div>

          <div className="rs-action-buttons">
            <input
              type="file"
              id="rs-file-kml"
              accept=".kml"
              className="rs-hidden"
            />
            <input
              type="file"
              id="rs-file-csv"
              accept=".csv"
              className="rs-hidden"
            />
            <input
              type="file"
              id="rs-file-excel"
              accept=".xls, .xlsx"
              className="rs-hidden"
            />

            <button
              type="button"
              id="rs-btn-verify"
              className="rs-btn rs-btn-primary"
              onClick={() =>
                (
                  containerRootRef.current?.querySelector(
                    '#rs-file-kml'
                  ) as HTMLInputElement
                )?.click()
              }
              style={{ backgroundColor: '#004C27', color: '#ffffff' }}
            >
              🗺️ Importar e Corrigir KML
            </button>
            <button
              type="button"
              id="rs-btn-extract"
              className="rs-btn rs-btn-outline"
            >
              📊 Extrair Apenas Coordenadas
            </button>

            <button
              type="button"
              id="rs-btn-excel"
              className="rs-btn rs-btn-primary"
              onClick={() =>
                (
                  containerRootRef.current?.querySelector(
                    '#rs-file-excel'
                  ) as HTMLInputElement
                )?.click()
              }
            >
              📊 Importar Planilha (XLS / XLSX)
            </button>
            <button
              type="button"
              id="rs-btn-extract-glebas"
              className="rs-btn rs-btn-outline"
            >
              🚜 Extrair para GLEBAS (TXT)
            </button>

            <button
              type="button"
              id="rs-btn-csv"
              className="rs-btn rs-btn-primary"
              onClick={() =>
                (
                  containerRootRef.current?.querySelector(
                    '#rs-file-csv'
                  ) as HTMLInputElement
                )?.click()
              }
            >
              📑 Importar Planilha (CSV)
            </button>
            <button
              type="button"
              id="rs-btn-extract-xls"
              className="rs-btn rs-btn-outline"
              style={{
                borderLeftColor: '#107c41',
                color: '#107c41',
                fontWeight: 700,
              }}
            >
              📈 EXCEL PLANILHA DE COORDENADAS
            </button>

            <button
              type="button"
              id="rs-btn-new"
              className="rs-btn rs-btn-success"
            >
              ➕ Criar / Editar Manualmente
            </button>
            <button
              type="button"
              id="rs-btn-clear"
              className="rs-btn rs-btn-danger"
            >
              🗑️ Limpar Tudo (Nova Análise)
            </button>
          </div>

          <hr className="rs-divider" />

          <div
            id="rs-risk-module"
            className="rs-card-module"
            style={{ borderLeft: '4px solid #D99700' }}
          >
            <h3 className="rs-subtitle">🚫 Áreas de Risco (Farmcheck) & CAR</h3>

            <div className="rs-flex-row" style={{ marginBottom: '8px' }}>
              <input
                type="file"
                id="rs-file-farmcheck"
                accept=".kml"
                className="rs-hidden"
                multiple
              />
              <button
                type="button"
                id="rs-btn-import-farmcheck"
                className="rs-btn rs-btn-outline"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
                onClick={() =>
                  (
                    containerRootRef.current?.querySelector(
                      '#rs-file-farmcheck'
                    ) as HTMLInputElement
                  )?.click()
                }
              >
                📥 IMPORTAR APP / RESERVA LEGAL
              </button>
            </div>

            <div className="rs-flex-row" style={{ marginBottom: '10px' }}>
              <input
                type="file"
                id="rs-file-car"
                accept=".kml"
                className="rs-hidden"
              />
              <button
                type="button"
                id="rs-btn-import-car"
                className="rs-btn rs-btn-outline"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  textAlign: 'center',
                  borderLeftColor: '#00A550',
                }}
                onClick={() =>
                  (
                    containerRootRef.current?.querySelector(
                      '#rs-file-car'
                    ) as HTMLInputElement
                  )?.click()
                }
              >
                🗺️ IMPORTAR LIMITE DO CAR OFICIAL
              </button>
            </div>

            <div
              id="rs-risk-list-group"
              className="rs-checklist-box"
              style={{ maxHeight: '110px', marginBottom: '10px' }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  padding: '4px',
                  textAlign: 'center',
                }}
              >
                Nenhuma restrição importada...
              </div>
            </div>

            <button
              type="button"
              id="rs-btn-auto-fix"
              className="rs-btn rs-btn-primary rs-full-width"
              style={{
                backgroundColor: '#004C27',
                color: '#FFFFFF',
                justifyContent: 'center',
              }}
            >
              ✂️ RECORTAR SOBREPOSIÇÕES
            </button>

            <button
              type="button"
              id="rs-btn-auto-fit-car"
              className="rs-btn rs-btn-primary rs-full-width"
              style={{
                backgroundColor: '#D99700',
                color: '#ffffff',
                marginTop: '8px',
                justifyContent: 'center',
                border: 'none',
              }}
            >
              🎯 ENQUADRAR NO CAR
            </button>
          </div>

          <hr className="rs-divider" />

          <div id="rs-glebas-container" className="rs-hidden">
            <h3 className="rs-subtitle">Glebas do Projeto</h3>

            <div className="rs-input-group">
              <label htmlFor="rs-new-gleba-name">Criar Nova Gleba:</label>
              <div className="rs-flex-row">
                <input
                  type="text"
                  id="rs-new-gleba-name"
                  className="rs-input"
                  placeholder="Ex: Curral, Sede..."
                />
                <button
                  type="button"
                  id="rs-btn-add-gleba"
                  className="rs-btn rs-btn-success"
                  style={{ width: 'auto', padding: '0 14px', height: '32px' }}
                >
                  ➕
                </button>
              </div>
            </div>

            <div className="rs-input-group">
              <div
                className="rs-flex-row"
                style={{ justifyContent: 'space-between', marginBottom: '6px' }}
              >
                <label style={{ margin: 0 }}>Glebas Disponíveis:</label>
                <div>
                  <button
                    type="button"
                    id="rs-btn-check-all"
                    className="rs-mini-btn"
                    style={{ fontSize: '0.75rem', color: '#2563eb' }}
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    id="rs-btn-uncheck-all"
                    className="rs-mini-btn"
                    style={{ fontSize: '0.75rem', color: '#475569' }}
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>
              <div id="rs-glebas-list-group" className="rs-checklist-box"></div>
            </div>

            <div className="rs-input-group">
              <label
                id="rs-lbl-coords"
                htmlFor="rs-coords-input"
                style={{
                  fontWeight: 600,
                  color: '#0f172a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div>
                  Coordenadas{' '}
                  <span
                    id="rs-active-gleba-title"
                    style={{ color: '#ef4444' }}
                  >
                    [NENHUMA ÁREA SELECIONADA]
                  </span>
                </div>

                <div
                  id="rs-container-botoes-edit"
                  style={{ display: 'none', gap: '8px' }}
                >
                  <button
                    type="button"
                    id="rs-btn-activate-edit"
                    className="rs-btn rs-btn-outline"
                    data-active="false"
                    style={{
                      flex: 1,
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                      backgroundColor: '#f1f5f9',
                      justifyContent: 'center',
                    }}
                  >
                    🗺️ Ajustar Geometria
                  </button>
                  <button
                    type="button"
                    id="rs-btn-draw-mode"
                    className="rs-btn rs-btn-outline"
                    data-drawing="false"
                    style={{
                      width: 'auto',
                      fontSize: '1.1rem',
                      padding: '4px 12px',
                      backgroundColor: '#f1f5f9',
                      justifyContent: 'center',
                    }}
                    title="Modo Caneta: Clicar no mapa para adicionar pontos"
                  >
                    ✒️
                  </button>
                </div>
              </label>

              <div className="rs-textarea-container">
                <textarea
                  id="rs-coords-input"
                  className="rs-textarea"
                  placeholder="-4.1143765309, -46.5736519898, 0..."
                />
                <div
                  id="rs-coords-overlay"
                  className="rs-textarea-overlay"
                  aria-hidden="true"
                />
              </div>
              <small className="rs-hint">
                Insira Latitude, Longitude. Nós ajustados recebem selo
                holográfico.
              </small>
            </div>

            <button
              type="button"
              id="rs-btn-download-new"
              className="rs-btn rs-btn-primary rs-full-width"
              style={{ backgroundColor: '#004C27', color: '#ffffff' }}
            >
              📥 Baixar Novo KML
            </button>
          </div>
        </aside>

        <main id="rs-map-area" className="rs-map-panel">
          <div id="rs-map-render" />
        </main>
      </div>

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DA EXPORTAÇÃO */}
      <div
        id="rs-export-modal"
        className="rs-hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.6)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            width: '650px',
            maxWidth: '95%',
            borderRadius: '6px',
            padding: '20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            border: '1px solid #CBD5E1',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #D99700',
              paddingBottom: '10px',
            }}
          >
            <h3
              id="rs-export-modal-title"
              style={{
                margin: 0,
                color: '#334155',
                fontSize: '1.05rem',
                textTransform: 'uppercase',
              }}
            >
              Pré-visualização da Exportação
            </h3>
            <button
              type="button"
              onClick={() =>
                containerRootRef.current
                  ?.querySelector('#rs-export-modal')
                  ?.classList.add('rs-hidden')
              }
              style={{
                width: 'auto',
                background: 'transparent',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                color: '#64748B',
              }}
            >
              ✖
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              Você pode revisar, copiar ou editar o conteúdo abaixo antes de
              baixar:
            </label>
            <textarea
              id="rs-export-textarea"
              style={{
                width: '100%',
                height: '350px',
                fontFamily: 'Consolas, monospace',
                fontSize: '0.8rem',
                padding: '12px',
                border: '1px solid #CBD5E1',
                borderRadius: '4px',
                resize: 'none',
                background: '#F9FAFB',
                color: '#334155',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '5px',
            }}
          >
            <button
              type="button"
              id="rs-btn-modal-copy"
              className="rs-btn rs-btn-outline"
              style={{ width: 'auto', borderLeft: '3px solid #D99700' }}
            >
              📋 Copiar Tudo
            </button>
            <button
              type="button"
              id="rs-btn-modal-download"
              className="rs-btn rs-btn-primary"
              style={{
                width: 'auto',
                backgroundColor: '#004C27',
                color: 'white',
              }}
            >
              💾 Baixar Arquivo TXT
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}