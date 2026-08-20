// ===========================================================
// 1. COMUNICAÇÃO DA EXTENSÃO (CONTENT SCRIPT)
// ===========================================================
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

if (window.location.href.includes("croamis.latamcargo.com")) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.tipo === "PREENCHER_CROAMIS") {
      preencherFormularioCroamis(request.payload);
      sendResponse({ status: "iniciado" });
    }
    return true;
  });
}

// ===========================================================
// 2. FUNÇÕES AUXILIARES DE SUPORTE
// ===========================================================
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function atribuirValorInput(inputElement, valor) {
  if (!inputElement) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeSetter.call(inputElement, valor);
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

async function fecharAlertasModal() {
  const botoesModal = Array.from(document.querySelectorAll('button, input[type="button"], a, .ui-dialog-buttonpane button'));

  for (let btn of botoesModal) {
    const texto = (btn.value || btn.innerText || '').trim().toLowerCase();
    if (texto === 'fechar' || texto === 'close' || texto === 'ok') {
      if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
        console.log("⚠️ Fechando alerta modal detectado na tela...");
        btn.click();
        await esperar(500);
      }
    }
  }
}

// ===========================================================
// 3. MAPA E PREENCHIMENTO MANUAL DE DESTINATÁRIOS E IE
// ===========================================================
const MAPA_IE_DESTINATARIOS_PAGANTES = {
  "43470566003296": "064152774", // IGUATEMI FORTALEZA
  "43470566008760": "271772492", // RIO MAR ARACAJU
  "43470566011043": "158221710", // SHOPPING GRAO PARA
  "43470566008506": "158221702", // BOULEVARD BELEM
  "43470566005906": "063600323", // RIO MAR FORTALEZA
  "43470566002052": "74074254",  // SALVADOR SHOPPING
  "43470566007445": "206572883", // MIDWAY
  "43470566010586": "054566657", // MANAUARA
  "43470566008093": "205226973"  // NATAL
};

const MAPA_REMETENTES_DADOS = {
  "43470566007100": { nome: "LEBLON", cep: "22430060", ie: "87400689", numero: "290", produto: "ST2BA" },
  "43470566009065": { nome: "ICARAI", cep: "24220215", ie: "12336730", numero: "239", produto: "ST2BA" },
  "43470566002214": { nome: "RIO DESIGN BARRA", cep: "22793081", ie: "78394005", numero: "7777", produto: "ST2BA" },
  "43470566013500": { nome: "HAIGHT RIO DESIGN", cep: "22793081", ie: "15691220", numero: "07777", produto: "ST2BA" },
  "43470566013844": { nome: "HAIGHT LEBLON", cep: "22430060", ie: "15726300", numero: "290", produto: "ST2BA" },
  "43470566013925": { nome: "HAIGHT VILLAGE MALL", cep: "22640102", ie: "15726318", numero: "03900", produto: "ST2BA" },
  "43470566006988": { nome: "TIJUCA", cep: "20511000", ie: "87313891", numero: "987", produto: "ST2BA" },
  "43470566010829": { nome: "RIO SUL", cep: "22290070", ie: "14381163", numero: "445", produto: "ST2BA" },
  "43470566004853": { nome: "BARRA SHOPPING", cep: "22640102", ie: "79943169", numero: "04666", produto: "ST2BA" },
  "43470566013330": { nome: "HAIGHT DIAS", cep: "22431050", ie: "15623616", numero: "00217", produto: "ST2BA" },
  "43470566008417": { nome: "VITORIA", cep: "29050420", ie: "083570233", numero: "200", produto: "ST2BA" },
  "43470566010233": { nome: "VILA VELHA", cep: "29107010", ie: "084050314", numero: "2418", produto: "ST2BA" },
  "43470566007879": { nome: "BATEL", cep: "80420090", ie: "9077812161", numero: "1868", produto: "ST2BA" },
  "43470566012368": { nome: "CATUAÍ LONDRINA", cep: "86050901", ie: "9113106783", numero: "5600", endereco: "LOC CELSO GARCIA CID", produto: "ST2BA" },
  "43470566012287": { nome: "CATUAÍ MARINGA", cep: "87070000", ie: "9112829170", numero: "9161", produto: "ST2BA" },
  "43470566010403": { nome: "ILHA", cep: "65074115", ie: "127945555", numero: "987", produto: "ST3BA" },
  "43470566013763": { nome: "RIO POTY", cep: "64003087", ie: "197955983", numero: "911", produto: "ST3BA" }
};

async function preencherIEDestinatarioPagante(escopo, cnpjAlvo) {
  const ieValor = MAPA_IE_DESTINATARIOS_PAGANTES[cnpjAlvo];
  if (!ieValor) return;

  await esperar(500);

  const campoIE = escopo.querySelector('#stateRegistration, input[id*="stateRegistration" i]') ||
    document.getElementById('stateRegistration');

  if (campoIE) {
    console.log(`📝 Injetando IE (${ieValor}) para o CNPJ ${cnpjAlvo}...`);
    campoIE.removeAttribute('readonly');
    campoIE.removeAttribute('disabled');
    campoIE.focus();
    campoIE.click();

    atribuirValorInput(campoIE, ieValor);

    await esperar(200);
    campoIE.dispatchEvent(new Event('change', { bubbles: true }));
    campoIE.dispatchEvent(new Event('blur', { bubbles: true }));
  }
}

async function preencherDestinatarioManual(escopo, cnpjAlvo) {
  const dados = MAPA_REMETENTES_DADOS[cnpjAlvo];
  if (!dados) return false;

  console.log(`✍️ [Destinatário Manual] Preenchendo dados de: ${dados.nome}`);

  const selectTax = escopo.querySelector('#taxIdType') || document.getElementById('taxIdType');
  if (selectTax) {
    selectTax.value = "CNPJ";
    selectTax.dispatchEvent(new Event('change', { bubbles: true }));
    await esperar(300);
  }

  const campoCNPJ = escopo.querySelector('#customerCode, #taxIdNumber, input[name*="taxId" i], input[name*="customer" i]') ||
    document.getElementById('taxIdNumber');

  if (campoCNPJ) {
    campoCNPJ.focus();
    campoCNPJ.click();
    atribuirValorInput(campoCNPJ, cnpjAlvo);
    await esperar(300);

    campoCNPJ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
    campoCNPJ.dispatchEvent(new Event('blur', { bubbles: true }));
    await esperar(800);
  }

  const campoNome = escopo.querySelector('#customerName, input[id*="customerName" i]');
  if (campoNome) {
    campoNome.removeAttribute('readonly');
    campoNome.focus();
    atribuirValorInput(campoNome, "SHOULDER S.A.");
    campoNome.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const campoCEP = escopo.querySelector('#zipCode, input[id*="zip" i]');
  if (campoCEP) {
    campoCEP.removeAttribute('readonly');
    campoCEP.focus();
    campoCEP.click();
    atribuirValorInput(campoCEP, dados.cep);
    await esperar(300);

    campoCEP.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
    campoCEP.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
    campoCEP.dispatchEvent(new Event('change', { bubbles: true }));
    campoCEP.dispatchEvent(new Event('blur', { bubbles: true }));

    await esperar(1000);
  }

  const campoIE = escopo.querySelector('#stateRegistration, input[id*="stateRegistration" i]');
  if (campoIE) {
    campoIE.removeAttribute('readonly');
    campoIE.removeAttribute('disabled');
    campoIE.focus();
    atribuirValorInput(campoIE, dados.ie);
    campoIE.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const campoCNAE = escopo.querySelector('#cnaeCode, input[id*="cnae" i]');
  if (campoCNAE) {
    campoCNAE.removeAttribute('readonly');
    campoCNAE.focus();
    atribuirValorInput(campoCNAE, "4930202");
    campoCNAE.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const campoEndereco = escopo.querySelector('#address, input[id*="address" i]');
  if (campoEndereco) {
    if (cnpjAlvo === "43470566012368" && dados.endereco) {
      campoEndereco.removeAttribute('readonly');
      campoEndereco.focus();
      atribuirValorInput(campoEndereco, dados.endereco);
      campoEndereco.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }

  const campoNumero = escopo.querySelector('#streetNum, #buildingNumber, input[id*="streetNum" i], input[id*="buildingNumber" i]') ||
    document.getElementById('streetNum');

  if (campoNumero) {
    campoNumero.removeAttribute('disabled');
    campoNumero.removeAttribute('readonly');
    campoNumero.focus();
    campoNumero.click();
    atribuirValorInput(campoNumero, dados.numero);
    await esperar(200);
    campoNumero.dispatchEvent(new Event('change', { bubbles: true }));
    campoNumero.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  await esperar(800);
  console.log(`✅ [Destinatário Manual] ${dados.nome} preenchido com sucesso! Numeração: ${dados.numero}`);
  return true;
}

// ===========================================================
// 4. BUSCA PADRÃO POR CNPJ (LUPA)
// ===========================================================
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
  await esperar(300);

  campoCNPJ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
  campoCNPJ.dispatchEvent(new Event('change', { bubbles: true }));
  campoCNPJ.dispatchEvent(new Event('blur', { bubbles: true }));

  await esperar(1000);

  const iconeLupa = escopo.querySelector('img[src*="search" i], img[src*="lov" i], img[onclick*="customer" i]') ||
    campoCNPJ.parentElement.querySelector('img');

  const campoNome = escopo.querySelector('#customerName, input[id*="customerName" i]');
  if ((!campoNome || !campoNome.value) && iconeLupa) {
    iconeLupa.click();
    await esperar(1500);

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
        await esperar(1200);
      }
    }
  }
}

// ===========================================================
// 5. TRATATIVA EXCLUSIVA DO MANAÍRA SHOPPING (POPUP CEP)
// ===========================================================
async function tratarManairaShopping(escopo) {
  console.log("🛍️ Executando tratativa especial de CEP para MANAIRA SHOPPING...");

  const lupaCEP = escopo.querySelector('#lovZipCode, img[onclick*="ZipCode" i], img[src*="search" i][id*="Zip" i]') ||
    document.getElementById('lovZipCode');

  if (lupaCEP) {
    lupaCEP.click();
    await esperar(1500);
  }

  const tabelaZip = document.querySelector('table[id*="zip" i], .ui-jqgrid-btable');
  if (tabelaZip) {
    const primeiraLinha = tabelaZip.querySelector('tbody tr.jqgrow, tbody tr:nth-child(2)');
    if (primeiraLinha) {
      primeiraLinha.click();
      const tdQualquer = primeiraLinha.querySelector('td');
      if (tdQualquer) tdQualquer.click();
      await esperar(400);
    }
  }

  const btnOk = document.getElementById('buttonFiveDialogOK') ||
    document.getElementById('lovDialogOK') ||
    Array.from(document.querySelectorAll('button')).find(b => b.innerText?.trim().toUpperCase() === 'OK' && b.offsetWidth > 0);

  if (btnOk) {
    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(btnOk).trigger('click');
    } else {
      btnOk.click();
    }
    await esperar(1200);
  }

  const campoNumero = escopo.querySelector('#streetNum, #buildingNumber, input[name*="buildingNumber" i]') ||
    document.getElementById('streetNum') || document.getElementById('buildingNumber');

  if (campoNumero) {
    campoNumero.removeAttribute('disabled');
    campoNumero.removeAttribute('readonly');
    campoNumero.focus();
    campoNumero.click();

    atribuirValorInput(campoNumero, "220");
    await esperar(300);

    campoNumero.dispatchEvent(new Event('change', { bubbles: true }));
    campoNumero.dispatchEvent(new Event('blur', { bubbles: true }));

    console.log("✅ [MANAIRA SHOPPING] CEP e Número 220 confirmados!");
  }
}

// ===========================================================
// 6. ORQUESTRADOR PRINCIPAL DO CROAMIS
// ===========================================================
async function preencherFormularioCroamis(dados) {
  console.log("⚡ Executando automação no CROAMIS para:", dados);

  const chkEntrega = document.getElementById('entrega');
  if (chkEntrega && !chkEntrega.checked) {
    chkEntrega.click();
    chkEntrega.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await esperar(200);

  const pagadorTexto = String(dados.pagador || dados.pagadorFrete || "").toUpperCase();
  const ehPagadorDestinatario = pagadorTexto.includes("DESTINATARIO") || pagadorTexto.includes("DESTINATÁRIO");

  const cnpjMatriz = "43470566002567";
  const cnpjCliente = String(dados.codigoDestinatario || dados.cnpj || "").replace(/\D/g, '');
  const nomeCliente = String(dados.destinatario || dados.nome || "").toUpperCase();

  // -----------------------------------------------------------
  // PASSO A: TOMADOR E REMETENTE/DESTINATÁRIO
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

  if (ehPagadorDestinatario) {
    // REGRA 1: PAGADOR = DESTINATÁRIO (Maceió, Salvador Shopping, Aracaju...)
    console.log(`💳 [Tomador - Pagador Destinatário] Injetando CNPJ da loja ${cnpjCliente}...`);
    await preencherEBuscarCNPJ(cnpjCliente, 'tabpage_1');
    await esperar(800);

    await preencherIEDestinatarioPagante(document.getElementById('tabpage_1') || document, cnpjCliente);

    const chkCopiarDestinatario = document.querySelector('#tabpage_1 input[value="Destinatario"], #tabpage_1 input[id*="Destinatario"]');
    if (chkCopiarDestinatario && !chkCopiarDestinatario.checked) {
      chkCopiarDestinatario.click();
      chkCopiarDestinatario.checked = true;
      chkCopiarDestinatario.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await esperar(800);

    const tabRemetente = document.querySelector('#tabHeader_2 a') || document.getElementById('tabHeader_2');
    if (tabRemetente) {
      tabRemetente.click();
      await esperar(500);
    }

    const selectTaxRemetente = document.querySelector('#tabpage_2 #taxIdType') || document.getElementById('taxIdType');
    if (selectTaxRemetente) {
      selectTaxRemetente.value = "CNPJ";
      selectTaxRemetente.dispatchEvent(new Event('change', { bubbles: true }));
      await esperar(300);
    }

    console.log(`🏭 [Remetente] Injetando CNPJ da MATRIZ ${cnpjMatriz}...`);
    await preencherEBuscarCNPJ(cnpjMatriz, 'tabpage_2');
    await esperar(1000);

  } else {
    // REGRA 2: PAGADOR = REMETENTE (Icaraí, Haight, Tijuca, Batel, Ilha, Rio Poty...)
    console.log(`💳 [Tomador - Pagador Remetente] Injetando CNPJ da MATRIZ ${cnpjMatriz}...`);
    await preencherEBuscarCNPJ(cnpjMatriz, 'tabpage_1');
    await esperar(1000);

    const chkCopiarRemetente = document.querySelector('#tabpage_1 input[value="Remetente"], #tabpage_1 input[id*="Remetente"]');
    if (chkCopiarRemetente && !chkCopiarRemetente.checked) {
      chkCopiarRemetente.click();
      chkCopiarRemetente.checked = true;
      chkCopiarRemetente.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await esperar(800);

    const tabDestinatario = document.querySelector('#tabHeader_3 a') || document.getElementById('tabHeader_3');
    if (tabDestinatario) {
      tabDestinatario.click();
      await esperar(400);
    }

    if (cnpjCliente) {
      console.log(`🎯 [Destinatário] Preenchendo dados da loja cliente: ${cnpjCliente}...`);
      const foiManual = await preencherDestinatarioManual(document.getElementById('tabpage_3') || document, cnpjCliente);

      if (!foiManual) {
        await preencherEBuscarCNPJ(cnpjCliente, 'tabpage_3');
      }
    }

    if (cnpjCliente === "43470566008689" || nomeCliente.includes("MANAIRA")) {
      await tratarManairaShopping(document.getElementById('tabpage_3') || document);
    }
  }

  await esperar(500);

  // -----------------------------------------------------------
  // PASSO D: ORIGEM, COMMODITY E HANDLING
  // -----------------------------------------------------------
  const campoOrigin = document.getElementById('origin');
  if (campoOrigin) {
    campoOrigin.focus();
    atribuirValorInput(campoOrigin, "CGR");
  }

  await esperar(200);

  const campoCmdty = document.getElementById('commodityCode') || document.getElementById('inputCommodityCode');
  if (campoCmdty) {
    campoCmdty.focus();
    campoCmdty.click();

    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(campoCmdty).val("0611").trigger("input").trigger("change").trigger("keydown");
    } else {
      atribuirValorInput(campoCmdty, "0611");
    }
  }

  await esperar(300);

  const campoNature = document.getElementById('natureOfGoods');
  if (campoNature) {
    campoNature.focus();
    campoNature.click();
    if (campoCmdty) campoCmdty.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  await esperar(400);

  const campoHandling = document.getElementById('handlingCode');
  if (campoHandling) {
    campoHandling.focus();
    campoHandling.click();

    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(campoHandling).val("99").trigger("input").trigger("change").trigger("keydown");
    } else {
      atribuirValorInput(campoHandling, "99");
    }

    await esperar(150);
    campoHandling.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  await esperar(500);

  // -----------------------------------------------------------
  // PASSO E: DIMENSÕES (DIMS AND ULD)
  // -----------------------------------------------------------
  const btnOpenDims = document.getElementById('openDimsAndUld');
  if (btnOpenDims) {
    btnOpenDims.click();
    await esperar(2000);

    const caixas = dados.caixas && dados.caixas.length > 0 ? dados.caixas : [
      { qtd: dados.qtdPecasTotal || 1, peso: dados.pesoBrutoTotal || 15.6, comp: 60, larg: 39, alt: 33 }
    ];

    const tdAdd = document.getElementById('dimsAndUldloosePiecesGridA') || document.querySelector('td[id*="loosePiecesGridA" i]');

    for (let i = 0; i < caixas.length; i++) {
      const c = caixas[i];

      if (tdAdd) {
        const divInterna = tdAdd.querySelector('.ui-pg-div') || tdAdd;
        divInterna.click();
        await esperar(1000);
      }

      const idLinha = i + 1;

      if (window.$ || window.jQuery) {
        try {
          (window.$ || window.jQuery)('#loosePiecesGrid').jqGrid('editRow', idLinha, true);
        } catch (err) { }
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
        } catch (err) { }
      }

      await esperar(500);
    }

    await esperar(800);

    const btnSaveDims = document.getElementById('buttonSaveLooseAndUldDetails') || document.getElementById('dimsUldSave');

    if (btnSaveDims) {
      btnSaveDims.click();
    }
  }

  await fecharAlertasModal();
  await esperar(800);

  // -----------------------------------------------------------
  // PASSO F: TRATAMENTO -> SERVIÇO -> PRODUTO (MANAUARA = ST5BA | ILHA/POTY = ST3BA)
  // -----------------------------------------------------------
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

  let produtoFinal = "ST3BA"; // Padrão
  if (nomeCliente.includes("MANAUARA") || cnpjCliente.includes("43470566010586")) {
    produtoFinal = "ST5BA";
  } else if (
    (MAPA_REMETENTES_DADOS[cnpjCliente] && cnpjCliente !== "43470566010403" && cnpjCliente !== "43470566013763") ||
    nomeCliente.includes("SALVADOR") ||
    nomeCliente.includes("MACEIO") ||
    nomeCliente.includes("NATAL") ||
    nomeCliente.includes("MIDWAY") ||
    cnpjCliente.includes("43470566002052") ||
    cnpjCliente.includes("43470566007445") ||
    cnpjCliente.includes("43470566008093") ||
    cnpjCliente.includes("43470566008506") ||
    cnpjCliente.includes("43470566011043")
  ) {
    produtoFinal = "ST2BA";
  }

  const elProduct = document.getElementById('productCode') || document.getElementById('product');

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
  }

  await esperar(500);

  // -----------------------------------------------------------
  // PASSO G: NOTA FISCAL (e-Doc -> NF Electronic -> GRID)
  // -----------------------------------------------------------
  const listaNfes = (dados.listaNfes && dados.listaNfes.length > 0) ? dados.listaNfes : [
    { chaveNfe: dados.chaveNfe || "", valorTotalProduto: dados.valorTotalProduto || "0" }
  ];

  const abaEdoc = document.querySelector('div[data-tab="slidetab5"]') || document.querySelector('p[title="e-Doc"]');
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

  let somaTotalCarga = 0;

  for (let i = 0; i < listaNfes.length; i++) {
    const nf = listaNfes[i];

    let valorNumerico = parseFloat(String(nf.valorTotalProduto || "0").replace(',', '.'));
    if (isNaN(valorNumerico) || valorNumerico === 0) valorNumerico = 15000.00;

    somaTotalCarga += valorNumerico;
    const valorFormatado = valorNumerico.toFixed(2);

    const btnAdd = document.querySelector('#NFElectronicGridA .ui-pg-div') ||
      document.querySelector('#NFElectronicGridA') ||
      document.getElementById('add_nfe');

    if (btnAdd) {
      btnAdd.click();
      await esperar(800);
    }

    const linhasGrid = document.querySelectorAll('#NFElectronicGrid tr.jqgrow, #NFElectronicGrid tr[role="row"]:not(.jqgfirstrow)');
    const trAtual = linhasGrid[i] || linhasGrid[linhasGrid.length - 1];

    if (!trAtual) continue;

    const idLinhaReal = trAtual.getAttribute('id');

    if (window.$ || window.jQuery) {
      try {
        (window.$ || window.jQuery)('#NFElectronicGrid').jqGrid('editRow', idLinhaReal, true);
      } catch (e) { }
    }
    await esperar(300);

    // 1. Chave de Acesso
    const tdChave = trAtual.querySelector('td[aria-describedby*="accessKey"]');
    let inputChave = document.getElementById(`${idLinhaReal}_accessKey`) || (tdChave ? tdChave.querySelector('input') : null);

    if (inputChave) {
      inputChave.focus();
      inputChave.value = nf.chaveNfe;
      inputChave.dispatchEvent(new Event('input', { bubbles: true }));
      inputChave.dispatchEvent(new Event('change', { bubbles: true }));
      await esperar(200);
    }

    // 2. Valor da Carga
    const tdValor = trAtual.querySelector('td[aria-describedby*="cargoValue"]');
    if (tdValor) tdValor.click();

    let inputValor = document.getElementById(`${idLinhaReal}_cargoValue`) || (tdValor ? tdValor.querySelector('input') : null);

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

      await esperar(300);

      console.log(`⚡ Disparando ENTER na célula de valor da NF ${i + 1}...`);
      inputValor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true }));
      inputValor.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true }));
      inputValor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true }));
      inputValor.dispatchEvent(new Event('change', { bubbles: true }));
      inputValor.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    await esperar(300);

    if (window.$ || window.jQuery) {
      try {
        (window.$ || window.jQuery)('#NFElectronicGrid').jqGrid('saveRow', idLinhaReal);
      } catch (e) { }
    }
    await esperar(500);
  }

  // 3. INJEÇÃO DA SOMA NO CAMPO PRINCIPAL (#cargoValue)
  const valorTotalConsolidado = somaTotalCarga.toFixed(2);
  console.log(`💰 Total Consolidado das NFs: R$ ${valorTotalConsolidado}`);

  const campoValorCargaPrincipal = document.getElementById('cargoValue') ||
    document.querySelector('input#cargoValue') ||
    document.getElementById('declaredValue');

  if (campoValorCargaPrincipal) {
    campoValorCargaPrincipal.focus();
    campoValorCargaPrincipal.click();

    if (window.$ || window.jQuery) {
      (window.$ || window.jQuery)(campoValorCargaPrincipal).val(valorTotalConsolidado).trigger("input").trigger("change");
    } else {
      atribuirValorInput(campoValorCargaPrincipal, valorTotalConsolidado);
    }

    await esperar(200);

    campoValorCargaPrincipal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, code: 'Tab', bubbles: true }));
    campoValorCargaPrincipal.dispatchEvent(new Event('change', { bubbles: true }));
    campoValorCargaPrincipal.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  if (document.activeElement) document.activeElement.blur();
  await esperar(500);

  // -----------------------------------------------------------
  // PASSO H: AD-VALOREM + SEGURO
  // -----------------------------------------------------------
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

  const popupAdValorem = document.getElementById('adValoremPopup') ?
    document.getElementById('adValoremPopup').closest('.ui-dialog') : document;

  const btnOkInsurance = Array.from(popupAdValorem.querySelectorAll('div.ui-dialog-buttonset button'))
    .find(btn => btn.innerText.trim().toUpperCase() === 'OK');

  if (btnOkInsurance) {
    btnOkInsurance.focus();
    btnOkInsurance.click();
    await esperar(500);
  }

  await esperar(800);

  // -----------------------------------------------------------
  // PASSO I: ITINERÁRIO DE VOO
  // -----------------------------------------------------------
  if (document.activeElement) document.activeElement.blur();
  await esperar(300);

  const secaoVoo = document.getElementById('flightItineraryDetailsGrid') || document.querySelector('.ui-jqgrid');
  if (secaoVoo) {
    secaoVoo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await esperar(400);
  }

  const inputDestinoObj = document.getElementById('destination') || document.querySelector('input[name*="destination" i]');
  const destinoFinal = inputDestinoObj ? inputDestinoObj.value.trim().toUpperCase() : "REC";

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
  } else if (vooOpcaoUser.includes("3535") || vooOpcaoUser === "3535") {
    hubConexao = "GRU";
    vooNumero = "3535";
  } else if (vooOpcaoUser.includes("3807") || vooOpcaoUser === "3807") {
    hubConexao = "BSB";
    vooNumero = "3807";
  } else {
    hubConexao = "BSB";
    vooNumero = "3717";
  }

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

  const btnAdd1 = obterBotaoAdd();
  if (btnAdd1) {
    btnAdd1.click();
    await esperar(800);
  }

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

  const btnAdd2 = obterBotaoAdd();
  if (btnAdd2) {
    btnAdd2.click();
    await esperar(800);
  }

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

  // -----------------------------------------------------------
  // PASSO J: EMITIR CTE + OVERRIDE (DESATIVADO TEMPORARIAMENTE)
  // -----------------------------------------------------------
  const PERMITIR_EMISSAO_AUTOMATICA = false;

  if (PERMITIR_EMISSAO_AUTOMATICA) {
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
        await esperar(500);
      }
    }

    if (btnEmitirCte) {
      btnEmitirCte.focus();
      btnEmitirCte.click();
    }

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
      btnOverride.focus();
      btnOverride.click();
      await esperar(1000);
    }
  } else {
    console.log("⏸️ Emissão automática bloqueada (PERMITIR_EMISSAO_AUTOMATICA = false).");
  }
}