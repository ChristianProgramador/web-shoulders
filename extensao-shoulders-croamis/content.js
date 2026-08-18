if (window.location.href.includes("127.0.0.1") || window.location.href.includes("localhost") || window.location.href.includes("github.io")) {
  window.addEventListener("message", (event) => {
    if (event.data && (event.data.tipo === "PREENCHER_CROAMIS" || event.data.tipo === "EMITIR_LOTE_CROAMIS")) {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage(event.data);
        } else {
          console.warn("⚠️ Extensão recarregada. Por favor, atualize esta página (F5).");
        }
      } catch (err) {
        console.warn("⚠️ Contexto da extensão invalidado. Recarregue a página com F5.");
      }
    }
  });
}

// 2. Executa a automação no CROAMIS Cargo
if (window.location.href.includes("croamis.latamcargo.com")) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.tipo === "PREENCHER_CROAMIS") {
      preencherFormularioCroamis(request.payload);
      sendResponse({ status: "iniciado" });
    }
    return true;
  });
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// HELPER INFALÍVEL PARA ATRIBUIÇÃO DE VALORES EM INPUTS (Bypassa reatividade de UI)
function atribuirValorInput(inputElement, valor) {
  if (!inputElement) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeSetter.call(inputElement, valor);
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// Trata e fecha qualquer modal de alerta do CROAMIS (ex: 'Please enter OD')
async function fecharAlertasModal() {
  const botoesModal = Array.from(document.querySelectorAll('button, input[type="button"], a, .ui-dialog-buttonpane button'));

  for (let btn of botoesModal) {
    const texto = (btn.value || btn.innerText || '').trim().toLowerCase();
    if (texto === 'fechar' || texto === 'close' || texto === 'ok') {
      if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
        console.log("⚠️ Fechando alerta modal detectado na tela ('Please enter OD')...");
        btn.click();
        await esperar(500);
      }
    }
  }
}

// BUSCA E CONFIRMAÇÃO ESTÁVEL DE CNPJ
async function preencherEBuscarCNPJ(cnpjValor, abaId = '') {
  const escopo = abaId ? document.getElementById(abaId) : document;
  if (!escopo) return;

  const campoCNPJ = escopo.querySelector('#customerCode, #taxIdNumber, input[name*="taxId" i], input[name*="customer" i]') ||
    document.getElementById('customerCode') ||
    document.getElementById('taxIdNumber');

  if (!campoCNPJ) return;

  campoCNPJ.focus();
  campoCNPJ.click();

  atribuirValorInput(campoCNPJ, cnpjValor);
  await esperar(400);

  // Dispara a busca via Lupa
  const iconeLupa = escopo.querySelector('img[src*="search" i], img[src*="lov" i], img[onclick*="customer" i]') ||
    campoCNPJ.parentElement.querySelector('img');

  if (iconeLupa) {
    iconeLupa.click();
  } else {
    campoCNPJ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
    campoCNPJ.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Tempo de espera para o retorno do serviço da LATAM
  await esperar(2000);

  // Seleciona a linha do resultado na tabela LOV caso a modal abra
  const primeiraLinha = document.querySelector('.jqgrow, tr[role="row"][id="1"], table[id*="lov"] tbody tr:nth-child(2)');
  if (primeiraLinha) {
    primeiraLinha.click();
    await esperar(300);

    const btnOKModal = document.getElementById('lovDialogOK') ||
      Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).find(
        b => b.value === 'OK' || b.innerText.trim() === 'OK'
      );

    if (btnOKModal && btnOKModal.offsetWidth > 0) {
      btnOKModal.click();
      await esperar(1500);
    }
  }
}

// FUNÇÃO PRINCIPAL DE PREENCHIMENTO COMPLETO
async function preencherFormularioCroamis(dados) {
  console.log("⚡ Executando automação no CROAMIS para:", dados);

  // 1. Checkbox Entrega
  const chkEntrega = document.getElementById('entrega');
  if (chkEntrega && !chkEntrega.checked) {
    chkEntrega.click();
    chkEntrega.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await esperar(200);

  // -----------------------------------------------------------
  // PASSO A: TOMADOR & ALOCAÇÃO DO DESTINATÁRIO + INSCRIÇÃO ESTADUAL
  // -----------------------------------------------------------
  const tabTomador = document.querySelector('#tabHeader_1 a') || document.getElementById('tabHeader_1');
  if (tabTomador) {
    tabTomador.click();
    await esperar(300);
  }

  const selectTaxTomador = document.querySelector('#tabpage_1 #taxIdType') || document.getElementById('taxIdType');
  if (selectTaxTomador) {
    selectTaxTomador.value = "CNPJ";
    selectTaxTomador.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(300);
  }

  const cnpjCliente = String(dados.codigoDestinatario || dados.cnpj || "");
  if (cnpjCliente) {
    await preencherEBuscarCNPJ(cnpjCliente, 'tabpage_1');
  }

  await esperar(1200); // Aguarda o CROAMIS preencher os dados nativos do cliente

  // -----------------------------------------------------------
  // MAPA E PREENCHIMENTO DE INSCRIÇÃO ESTADUAL (SOMENTE QUANDO NECESSÁRIO)
  // -----------------------------------------------------------
  const mapaIEPorCNPJ = {
    "43470566003296": "064152774", // IGUATEMI FORTALEZA
    "43470566008760": "271772492", // RIO MAR ARACAJU
    "43470566009227": "158221702", // BOULEVARD BELEM
    "43470566002052": "74074254",  // SALVADOR SHOPPING
    "43470566010586": "054566657", // MANAUARA
    "43470566011043": "206572883", // MIDWAY
    "43470566005906": "063600323", // RIO MAR FORTALEZA
    "43470566008506": "205226973", // NATAL
    "43470566009146": "158221710"  // SHOPPING GRAO PARA
  };

  const cnpjApenasDigitos = cnpjCliente.replace(/\D/g, '');
  const ieDesejada = mapaIEPorCNPJ[cnpjApenasDigitos];

  const campoIE = document.querySelector('#tabpage_1 #stateRegistration') ||
    document.getElementById('stateRegistration') ||
    document.querySelector('input[name*="stateRegistration" i]');

  if (campoIE) {
    // SÓ PREENCHE SE FOR UM DOS 9 SHOPPINGS QUE EXIGEM IE MANUAL
    if (ieDesejada) {
      console.log(`📝 [IE] Aplicando IE manual para o CNPJ ${cnpjApenasDigitos}: ${ieDesejada}`);
      campoIE.removeAttribute('disabled');
      campoIE.removeAttribute('readonly');
      campoIE.focus();
      campoIE.click();
      campoIE.value = ieDesejada;
      atribuirValorInput(campoIE, ieDesejada);

      await esperar(200);
      campoIE.dispatchEvent(new Event('input', { bubbles: true }));
      campoIE.dispatchEvent(new Event('change', { bubbles: true }));
      campoIE.dispatchEvent(new Event('blur', { bubbles: true }));
    } else {
      // PARA MANAÍRA, RECIFE E DEMAIS: PRESERVA A IE NATIVA DO CROAMIS SEM APAGAR NADA
      console.log(`✅ [IE] Cliente isento/nativo. Mantendo IE original da tela: "${campoIE.value || 'Vazia'}"`);
    }
  }

  // -----------------------------------------------------------
  // ALOCAÇÃO DO DESTINATÁRIO (CHECKBOX)
  // -----------------------------------------------------------
  const chkDestinatario = document.querySelector('#tabpage_1 input[value="Destinatario"], #tabpage_1 input[id*="Destinatario"]');
  if (chkDestinatario && !chkDestinatario.checked) {
    chkDestinatario.click();
    chkDestinatario.checked = true;
    chkDestinatario.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await esperar(1000);
  // -----------------------------------------------------------
  // PASSO B: REMETENTE (MATRIZ)
  // -----------------------------------------------------------
  const tabRemetente = document.querySelector('#tabHeader_2 a') || document.getElementById('tabHeader_2');
  if (tabRemetente) {
    tabRemetente.click();
    await esperar(400);
  }

  const selectTaxRem = document.querySelector('#tabpage_2 #taxIdType') || document.getElementById('taxIdType');
  if (selectTaxRem) {
    selectTaxRem.value = "CNPJ";
    selectTaxRem.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(300);
  }

  const cnpjMatriz = "43470566002567";
  await preencherEBuscarCNPJ(cnpjMatriz, 'tabpage_2');

  await esperar(500);

  // -----------------------------------------------------------
  // PASSO C: ORIGEM, COMMODITY E HANDLING
  // -----------------------------------------------------------
  await esperar(400);

  const campoOrigin = document.getElementById('origin');
  if (campoOrigin) {
    campoOrigin.focus();
    atribuirValorInput(campoOrigin, "CGR");
  }

  await esperar(200);

  const campoCmdty = document.getElementById('commodityCode') ||
    document.getElementById('inputCommodityCode') ||
    document.querySelector('input[name*="commodityCode" i]');

  if (campoCmdty) {
    campoCmdty.focus();
    campoCmdty.click();

    if (window.$ || window.jQuery) {
      const $input = (window.$ || window.jQuery)(campoCmdty);
      $input.val("0611").trigger("input").trigger("change").trigger("keydown");
    } else {
      atribuirValorInput(campoCmdty, "0611");
    }
  }

  await esperar(300);

  const campoNature = document.getElementById('natureOfGoods') ||
    document.querySelector('input[id*="natureOfGoods" i]');

  if (campoNature) {
    campoNature.focus();
    campoNature.click();
    if (campoCmdty) {
      campoCmdty.dispatchEvent(new Event('blur', { bubbles: true }));
      if (window.$ || window.jQuery) {
        (window.$ || window.jQuery)(campoCmdty).trigger("blur");
      }
    }
  }

  await esperar(400);

  const campoHandling = document.getElementById('handlingCode') ||
    document.querySelector('input[name="handlingCode" i]');

  if (campoHandling) {
    campoHandling.focus();
    campoHandling.click();

    if (window.$ || window.jQuery) {
      const $handling = (window.$ || window.jQuery)(campoHandling);
      $handling.val("99").trigger("input").trigger("change").trigger("keydown");
    } else {
      atribuirValorInput(campoHandling, "99");
    }

    await esperar(150);
    campoHandling.dispatchEvent(new Event('blur', { bubbles: true }));
    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(campoHandling).trigger("blur");
    }
  }

  await esperar(500);

  // ===========================================================
  // PASSO 3: DIMENSÕES (DIMS AND ULD)
  // ===========================================================
  console.log("📐 Executando PASSO 3 (Abrindo Dimensões / Dims and ULD)...");

  const btnOpenDims = document.getElementById('openDimsAndUld');
  if (btnOpenDims) {
    btnOpenDims.click();

    await esperar(2000);

    const caixas = dados.caixas && dados.caixas.length > 0 ? dados.caixas : [
      { qtd: dados.qtdPecasTotal || 1, peso: dados.pesoBrutoTotal || 15.6, comp: 60, larg: 39, alt: 33 }
    ];

    const tdAdd = document.getElementById('dimsAndUldloosePiecesGridA') ||
      document.querySelector('td[id*="loosePiecesGridA" i]');

    for (let i = 0; i < caixas.length; i++) {
      const c = caixas[i];

      if (tdAdd) {
        console.log("➕ Clicando no Add...");
        const divInterna = tdAdd.querySelector('.ui-pg-div') || tdAdd;
        divInterna.click();
        await esperar(1000);
      }

      const idLinha = i + 1;

      if (window.$ || window.jQuery) {
        try {
          (window.$ || window.jQuery)('#loosePiecesGrid').jqGrid('editRow', idLinha, true);
        } catch (err) {
          console.log("editRow executado.");
        }
      }

      await esperar(400);

      const linhaTr = document.querySelector(`#loosePiecesGrid tr[id="${idLinha}"]`) ||
        document.querySelectorAll('#loosePiecesGrid tr.jqgrow')[i];

      const preencherColunaJqGrid = async (sufixoColuna, valor) => {
        if (!linhaTr) return;

        const td = linhaTr.querySelector(`td[aria-describedby*="${sufixoColuna}" i]`);

        if (td) {
          td.click();
          await esperar(150);
        }

        const input = (td ? td.querySelector('input') : null) ||
          document.getElementById(`${idLinha}_${sufixoColuna}`) ||
          linhaTr.querySelector(`input[name*="${sufixoColuna}" i]`);

        if (input) {
          input.focus();
          input.click();

          if (window.$ || window.jQuery) {
            (window.$ || window.jQuery)(input).val(valor).trigger("input").trigger("change");
          } else {
            atribuirValorInput(input, valor);
          }

          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
          await esperar(150);
        }
      };

      await preencherColunaJqGrid("noOfPieces", c.qtd);
      await preencherColunaJqGrid("totalWeight", parseFloat(c.peso).toFixed(2));
      await preencherColunaJqGrid("length", c.comp || 60);
      await preencherColunaJqGrid("width", c.larg || 39);
      await preencherColunaJqGrid("height", c.alt || 33);

      await esperar(400);

      if (window.$ || window.jQuery) {
        try {
          (window.$ || window.jQuery)('#loosePiecesGrid').jqGrid('saveRow', idLinha);
        } catch (err) {
          console.log("saveRow executado.");
        }
      }

      await esperar(500);
    }

    await esperar(800);

    const btnSaveDims = document.getElementById('buttonSaveLooseAndUldDetails') ||
      document.getElementById('dimsUldSave');

    if (btnSaveDims) {
      console.log("💾 Clicando em Save & Continue...");
      btnSaveDims.click();
    }
  }

  // Trata e fecha o alerta modal (ex: 'Please enter OD') se tiver aparecido
  await fecharAlertasModal();
  await esperar(800);

  // ===========================================================
  // PASSO 4: TRATAMENTO -> SERVIÇO -> PRODUTO (MAPA EXATO POR DESTINO)
  // ===========================================================
  console.log("⚡ Executando PASSO 4 via Injeção Direta por Destino...");

  // 1. Preenche Tratamento e Serviço
  const campoTreatment = document.getElementById('treatment') || document.querySelector('input[name*="treatment" i], select[name*="treatment" i]');
  if (campoTreatment) {
    if (campoTreatment.tagName === 'SELECT') {
      campoTreatment.value = "BASICO";
      campoTreatment.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      atribuirValorInput(campoTreatment, "BASICO");
    }
  }

  const campoService = document.getElementById('service') || document.querySelector('input[name*="service" i], select[name*="service" i]');
  if (campoService) {
    if (campoService.tagName === 'SELECT') {
      campoService.value = "STD";
      campoService.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      atribuirValorInput(campoService, "STD");
    }
  }

  await esperar(400);

  // 2. Mapeamento do Código de Produto por Destino / CNPJ
  const destUpper = String(dados.destinatario || dados.nome || "").toUpperCase();
  const cnpjDigitos = String(dados.codigoDestinatario || dados.cnpj || "").replace(/\D/g, '');

  let produtoFinal = "ST3BA"; // Padrão geral

  // Exceções conhecidas:
  if (destUpper.includes("SALVADOR") || cnpjDigitos.includes("43470566002052") || cnpjDigitos.includes("43470566007445")) {
    produtoFinal = "ST2BA"; // SALVADOR SHOPPING -> ST2
  } else if (destUpper.includes("MANAUARA") || cnpjDigitos.includes("43470566010586")) {
    produtoFinal = "ST5BA"; // MANAUARA -> ST5
  }

  console.log(`✈️ [Produto] Injetando código "${produtoFinal}" para ${destUpper || cnpjDigitos}...`);

  // 3. Aplicação do Produto no campo do CROAMIS
  const elProduct = document.getElementById('productCode') ||
    document.getElementById('product') ||
    document.querySelector('input[name*="product" i]');

  if (elProduct) {
    elProduct.focus();
    elProduct.click();

    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(elProduct).val(produtoFinal).trigger("input").trigger("change").trigger("keydown");
    } else {
      atribuirValorInput(elProduct, produtoFinal);
    }

    await esperar(300);
    elProduct.dispatchEvent(new Event('blur', { bubbles: true }));
    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(elProduct).trigger("blur");
    }
  }

  await esperar(500);
  console.log("🚀 PASSO 4 concluído com sucesso!");

  // ===========================================================
  // PASSO 5: NOTA FISCAL (e-Doc -> NF Electronic -> GRID)
  // ===========================================================
  console.log("📄 Preenchendo Notas Fiscais no CROAMIS...");

  const listaNfes = (dados.listaNfes && dados.listaNfes.length > 0) ? dados.listaNfes : [
    { chaveNfe: dados.chaveNfe || "", valorTotalProduto: dados.valorTotalProduto || "0" }
  ];

  const abaEdoc = document.querySelector('div[data-tab="slidetab5"]') ||
    document.querySelector('p[title="e-Doc"]');
  if (abaEdoc) {
    abaEdoc.click();
    await esperar(800);
  }

  const radioNfe = document.getElementById('NFElectronic');
  if (radioNfe) {
    radioNfe.click();
    radioNfe.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(600);
  }

  for (let i = 0; i < listaNfes.length; i++) {
    const nf = listaNfes[i];
    console.log(`📝 Processando NF #${i + 1} de ${listaNfes.length}: Chave=${nf.chaveNfe} | Valor=${nf.valorTotalProduto}`);

    let valorFormatado = String(nf.valorTotalProduto || "0").replace(',', '.');
    valorFormatado = parseFloat(valorFormatado).toFixed(2);
    if (valorFormatado === "NaN") valorFormatado = "0.00";

    const btnAdd = document.querySelector('#NFElectronicGridA .ui-pg-div') ||
      document.querySelector('#NFElectronicGridA') ||
      document.getElementById('add_nfe');
    if (btnAdd) {
      btnAdd.click();
      await esperar(800);
    }

    let trAtual = null;
    let tentativas = 0;
    const maxTentativas = 10;

    while (tentativas < maxTentativas) {
      const linhasGrid = document.querySelectorAll('#NFElectronicGrid tr.jqgrow, #NFElectronicGrid tr[role="row"]:not(.jqgfirstrow)');
      trAtual = linhasGrid[i] || linhasGrid[linhasGrid.length - 1];

      if (trAtual) break;

      tentativas++;
      console.log(`⏳ Aguardando renderização da linha NF #${i + 1} (Tentativa ${tentativas}/${maxTentativas})...`);
      await esperar(500);
    }

    if (!trAtual) {
      console.warn(`⚠️ Linha para a NF #${i + 1} não foi localizada no grid após o tempo limite.`);
      continue;
    }

    const idLinhaReal = trAtual.getAttribute('id');

    if (window.$ || window.jQuery) {
      try {
        (window.$ || window.jQuery)('#NFElectronicGrid').jqGrid('editRow', idLinhaReal, true);
      } catch (e) { }
    }
    await esperar(300);

    const tdChave = trAtual.querySelector('td[aria-describedby*="accessKey"]');
    if (tdChave) {
      tdChave.click();
      tdChave.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await esperar(200);
    }

    let inputChave = document.getElementById(`${idLinhaReal}_accessKey`) ||
      (tdChave ? tdChave.querySelector('input') : null);

    if (inputChave) {
      inputChave.focus();
      inputChave.click();

      if (window.$ || window.jQuery) {
        (window.$ || window.jQuery)(inputChave).val(nf.chaveNfe).trigger("input").trigger("change");
      } else {
        inputChave.value = nf.chaveNfe;
        inputChave.dispatchEvent(new Event('input', { bubbles: true }));
        inputChave.dispatchEvent(new Event('change', { bubbles: true }));
      }

      inputChave.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
      await esperar(300);
    }

    const tdValor = trAtual.querySelector('td[aria-describedby*="cargoValue"]');
    if (tdValor) {
      tdValor.click();
      tdValor.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await esperar(300);
    }

    let inputValor = document.getElementById(`${idLinhaReal}_cargoValue`) ||
      (tdValor ? tdValor.querySelector('input') : null);

    if (inputValor) {
      inputValor.focus();
      inputValor.click();

      if (window.$ || window.jQuery) {
        (window.$ || window.jQuery)(inputValor).val(valorFormatado).trigger("input").trigger("change");
      } else {
        inputValor.value = valorFormatado;
        inputValor.dispatchEvent(new Event('input', { bubbles: true }));
        inputValor.dispatchEvent(new Event('change', { bubbles: true }));
      }

      inputValor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
      inputValor.dispatchEvent(new Event('blur', { bubbles: true }));
      await esperar(300);
    }

    if (window.$ || window.jQuery) {
      try {
        (window.$ || window.jQuery)('#NFElectronicGrid').jqGrid('saveRow', idLinhaReal);
      } catch (e) { }
    }
    await esperar(600);
  }

  if (document.activeElement) {
    document.activeElement.blur();
  }
  await esperar(500);

  // ===========================================================
  // PASSO 6: AD-VALOREM (Customer) + SEGURO (AKAD SEGUROS)
  // ===========================================================
  console.log("🛡️ Selecionando Ad-Valorem (Customer)...");

  if (document.activeElement) {
    document.activeElement.blur();
  }
  await esperar(400);

  const selectAdValorem = document.getElementById('insurance');

  if (selectAdValorem) {
    selectAdValorem.focus();
    selectAdValorem.value = "Customer";

    selectAdValorem.dispatchEvent(new Event('input', { bubbles: true }));
    selectAdValorem.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(1000);
  }

  const inputInsurer = document.getElementById('insurerName');
  if (inputInsurer) {
    inputInsurer.focus();
    inputInsurer.click();
    inputInsurer.value = "AKAD SEGUROS";
    inputInsurer.dispatchEvent(new Event('input', { bubbles: true }));
    inputInsurer.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(300);
  }

  const inputPolicy = document.getElementById('policyNumber');
  if (inputPolicy) {
    inputPolicy.focus();
    inputPolicy.click();
    inputPolicy.value = "027982026010621000025";
    inputPolicy.dispatchEvent(new Event('input', { bubbles: true }));
    inputPolicy.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(300);
  }

  console.log("🔘 Confirmando Modal de Seguro...");

  const popupAdValorem = document.getElementById('adValoremPopup') ?
    document.getElementById('adValoremPopup').closest('.ui-dialog') : document;

  const btnOkInsurance = Array.from(popupAdValorem.querySelectorAll('div.ui-dialog-buttonset button'))
    .find(btn => btn.innerText.trim().toUpperCase() === 'OK');

  if (btnOkInsurance) {
    btnOkInsurance.focus();
    btnOkInsurance.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    btnOkInsurance.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    btnOkInsurance.click();
    await esperar(500);
  }

  if (window.$ || window.jQuery) {
    try {
      const $dialog = (window.$ || window.jQuery)('#adValoremPopup');
      if ($dialog.length && $dialog.is(':visible')) {
        const buttons = $dialog.dialog('option', 'buttons');
        if (buttons && typeof buttons === 'object') {
          const firstKey = Object.keys(buttons)[0];
          if (buttons[firstKey]) buttons[firstKey].apply($dialog[0]);
        }
        $dialog.dialog('close');
      }
    } catch (e) {
      console.log("Diálogo fechado via evento nativo.");
    }
  }

  await esperar(800);
  console.log("🎉 SEGURO E AD-VALOREM PROCESSADOS!");

  // ===========================================================
  // PASSO 7: ITINERÁRIO DE VOO
  // ===========================================================
  console.log("✈️ Preenchendo Itinerário de Voo com dados recebidos:", dados);

  if (document.activeElement) document.activeElement.blur();
  await esperar(300);

  const secaoVoo = document.getElementById('flightItineraryDetailsGrid') || document.querySelector('.ui-jqgrid');
  if (secaoVoo) {
    secaoVoo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await esperar(400);
  }

  // Destino Final
  const inputDestinoObj = document.getElementById('destination') ||
    document.querySelector('input[name*="destination" i]');
  const destinoFinal = inputDestinoObj ? inputDestinoObj.value.trim().toUpperCase() : "REC";

  // Captura exata do voo selecionado
  const vooOpcaoUser = String(dados.vooOpcao || "3717").trim().toUpperCase();

  let hubConexao = "BSB";
  let vooNumero = vooOpcaoUser;

  if (vooOpcaoUser.includes("9139") || vooOpcaoUser === "9139") {
    hubConexao = "CGH";
    vooNumero = "9139";
  } else if (vooOpcaoUser.includes("3177") || vooOpcaoUser === "3177") {
    hubConexao = "CGH";
    vooNumero = "3177";
  } else if (vooOpcaoUser.includes("9033") || vooOpcaoUser === "9033") {
    hubConexao = "GRU";
    vooNumero = "9033";
  } else if (vooOpcaoUser.includes("3127") || vooOpcaoUser === "3127") {
    hubConexao = "GRU";
    vooNumero = "3127";
  } else {
    hubConexao = "BSB";
    vooNumero = "3717";
  }

  console.log(`✈️ Voo Final Aplicado -> Numero: ${vooNumero} | Hub: ${hubConexao} (Valor Recebido: "${vooOpcaoUser}")`);

  // Datas DD-MMM-YYYY
  const mesesEng = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  function obterDataExataCroamis(diasAvançar) {
    const d = new Date();
    d.setDate(d.getDate() + diasAvançar);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = mesesEng[d.getMonth()];
    const ano = d.getFullYear();
    return `${dia}-${mes}-${ano}`;
  }

  const dataLinha1 = obterDataExataCroamis(1);
  const dataLinha2 = obterDataExataCroamis(2);

  const obterBotaoAdd = () => document.getElementById('add_flightItineraryDetailsGrid') ||
    document.querySelector('#flightItineraryDetailsGridA .ui-pg-div') ||
    document.querySelector('td[title*="Add" i]');

  const focarEDigitarEmCelula = async (trIndex, ariaCol, valorTexto) => {
    const linhas = document.querySelectorAll('#flightItineraryDetailsGrid tr.jqgrow, #flightItineraryDetailsGrid tr[role="row"]:not(.jqgfirstrow)');
    const tr = linhas[trIndex];
    if (!tr) return;

    const td = tr.querySelector(`td[aria-describedby*="${ariaCol}"]`);
    if (td) {
      td.click();
      td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      await esperar(200);
    }

    let elInput = (td ? td.querySelector('input') : null) ||
      document.querySelector('#flightItineraryDetailsGrid input:focus') ||
      document.querySelector('#flightItineraryDetailsGrid td.edit-cell input');

    if (elInput && elInput.tagName === 'INPUT') {
      elInput.focus();
      elInput.click();

      if (window.$ || window.jQuery) {
        (window.$ || window.jQuery)(elInput).val(valorTexto).trigger("input").trigger("change");
      } else {
        elInput.value = valorTexto;
        elInput.dispatchEvent(new Event('input', { bubbles: true }));
        elInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      await esperar(150);
      elInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
      elInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
      elInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await esperar(200);
    }
  };

  // 1. LINHA 1: ADD -> VOO -> DATA1 -> CGR -> HUB
  console.log(`📌 1. Criando Linha 1 via botão Add...`);
  const btnAdd1 = obterBotaoAdd();
  if (btnAdd1) {
    btnAdd1.click();
    await esperar(800);
  }

  console.log(`📌 Preenchendo Linha 1: Voo ${vooNumero} | ${dataLinha1} | CGR -> ${hubConexao}`);

  await focarEDigitarEmCelula(0, 'flightInfoSO.carrierNumber', vooNumero);
  await focarEDigitarEmCelula(0, 'flightInfoSO.dateOfDeparture', dataLinha1);
  await focarEDigitarEmCelula(0, 'segmentOfDeparture', "CGR");
  await focarEDigitarEmCelula(0, 'segmentOfArrival', hubConexao);

  if (window.$ || window.jQuery) {
    try {
      const tr1 = document.querySelectorAll('#flightItineraryDetailsGrid tr.jqgrow')[0];
      const id1 = tr1 ? tr1.getAttribute('id') : '1';
      (window.$ || window.jQuery)('#flightItineraryDetailsGrid').jqGrid('saveRow', id1);
    } catch (e) { }
  }
  await esperar(800);

  // 2. LINHA 2: ADD -> ZZ -> DATA2 -> HUB -> DESTINO
  console.log(`📌 2. Criando Linha 2 via botão Add...`);
  const btnAdd2 = obterBotaoAdd();
  if (btnAdd2) {
    btnAdd2.click();
    await esperar(800);
  }

  console.log(`📌 Preenchendo Linha 2: ZZ | ${dataLinha2} | ${hubConexao} -> ${destinoFinal}`);

  let inputCarrier2 = document.getElementById('2_carrierCode') || document.getElementById('2_flightInfoSO.carrierCode');
  if (inputCarrier2) {
    inputCarrier2.focus();
    inputCarrier2.click();
    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(inputCarrier2).val("ZZ").trigger("input").trigger("change");
    } else {
      inputCarrier2.value = "ZZ";
      inputCarrier2.dispatchEvent(new Event('input', { bubbles: true }));
      inputCarrier2.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await esperar(150);
    inputCarrier2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
    inputCarrier2.dispatchEvent(new Event('blur', { bubbles: true }));
    await esperar(200);
  } else {
    await focarEDigitarEmCelula(1, 'carrierCode', "ZZ");
  }

  await focarEDigitarEmCelula(1, 'flightInfoSO.dateOfDeparture', dataLinha2);
  await focarEDigitarEmCelula(1, 'segmentOfDeparture', hubConexao);
  await focarEDigitarEmCelula(1, 'segmentOfArrival', destinoFinal);

  if (window.$ || window.jQuery) {
    try {
      const linhas = document.querySelectorAll('#flightItineraryDetailsGrid tr.jqgrow');
      const tr2 = linhas[linhas.length - 1];
      const id2 = tr2 ? tr2.getAttribute('id') : '2';
      (window.$ || window.jQuery)('#flightItineraryDetailsGrid').jqGrid('saveRow', id2);
    } catch (e) { }
  }
  await esperar(600);

  console.log("🎉 ITINERÁRIO COMPLETO PREENCHIDO COM SUCESSO!");

  // ===========================================================
  // PASSO 8: CLIQUE INFALÍVEL EM EMITIR CTE + OVERRIDE
  // ===========================================================
  console.log("🚀 Iniciando PASSO 8: Buscando botão 'Emitir Cte'...");

  if (document.activeElement) document.activeElement.blur();
  await esperar(1000);

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  await esperar(800);

  function buscarElementoEmitirCte() {
    let escopos = [document];
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) escopos.push(iframe.contentDocument);
      } catch (e) { }
    });

    for (let escopo of escopos) {
      let btn = escopo.getElementById('issCTE') ||
        escopo.querySelector('input[value*="Emitir Cte" i]') ||
        escopo.querySelector('input#issCTE') ||
        Array.from(escopo.querySelectorAll('input[type="button"], button')).find(
          el => el.value?.trim().toLowerCase() === "emitir cte" || el.innerText?.trim().toLowerCase() === "emitir cte"
        );
      if (btn) return btn;
    }
    return null;
  }

  let btnEmitirCte = null;
  let tentativasBtn = 0;

  while (!btnEmitirCte && tentativasBtn < 12) {
    btnEmitirCte = buscarElementoEmitirCte();
    if (!btnEmitirCte) {
      tentativasBtn++;
      console.log(`⏳ Aguardando botão 'Emitir Cte' aparecer (Tentativa ${tentativasBtn}/12)...`);
      await esperar(500);
    }
  }

  if (btnEmitirCte) {
    console.log("🎯 Botão 'Emitir Cte' localizado! Executando cliques...");
    btnEmitirCte.focus();

    try {
      if (window.$ || window.jQuery) {
        (window.$ || window.jQuery)(btnEmitirCte).trigger("click");
      }
    } catch (e) { }

    btnEmitirCte.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    btnEmitirCte.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    btnEmitirCte.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    btnEmitirCte.click();

    console.log("✅ Disparo no 'Emitir Cte' realizado!");
  } else {
    console.warn("⚠️ Botão 'Emitir Cte' não encontrado.");
  }

  // -----------------------------------------------------------
  // TRATAMENTO DO PASSO FINAL / OVERRIDE
  // -----------------------------------------------------------
  await esperar(2500);

  function buscarBtnOverride() {
    let escopos = [document];
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) escopos.push(iframe.contentDocument);
      } catch (e) { }
    });

    for (let escopo of escopos) {
      let btn = escopo.getElementById('SHP051.button.ack') ||
        escopo.querySelector('button[id*="ack" i]') ||
        Array.from(escopo.querySelectorAll('button, input[type="button"]')).find(
          b => b.value?.includes("Override") || b.innerText?.includes("Override and save")
        );
      if (btn && btn.offsetWidth > 0) return btn;
    }
    return null;
  }

  const btnOverride = buscarBtnOverride();

  if (btnOverride) {
    console.log("⚠️ Soft Embargo detectado! Clicando em 'Override and save'...");
    btnOverride.focus();
    btnOverride.click();
    await esperar(1000);
    console.log("🎉 Embargo superado e Cte emitido com sucesso!");
  } else {
    console.log("🎉 Processo finalizado!");
  }
}