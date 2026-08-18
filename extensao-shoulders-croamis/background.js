chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.tipo === "PREENCHER_CROAMIS") {
    duplicarEPreencherAba(request.payload);
  }
});

function duplicarEPreencherAba(payloadData) {
  // Busca qualquer aba que contenha 'croamis.latamcargo.com'
  chrome.tabs.query({}, (tabs) => {
    const abaCroamis = tabs.find(t => t.url && t.url.includes("croamis.latamcargo.com"));

    if (!abaCroamis) {
      console.warn("⚠️ Nenhuma aba do CROAMIS encontrada aberta.");
      
      // Exibe o alerta na aba ativa em que o usuário está (onde o clique ocorreu)
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        if (activeTabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: activeTabs[0].id },
            func: () => {
              alert("⚠️ Atenção: Deixe ao menos UMA aba do CROAMIS aberta na tela de Emissão!");
            }
          });
        }
      });
      return;
    }

    chrome.tabs.duplicate(abaCroamis.id, (novaAba) => {
      let mensagemEnviada = false;

      const tentarEnviar = (tentativas = 0) => {
        if (mensagemEnviada || tentativas > 15) return;

        chrome.tabs.sendMessage(novaAba.id, {
          tipo: "PREENCHER_CROAMIS",
          payload: payloadData
        }, (response) => {
          if (chrome.runtime.lastError) {
            setTimeout(() => tentarEnviar(tentativas + 1), 500);
          } else {
            mensagemEnviada = true;
            console.log("✈️ Sucesso ao enviar dados para a nova aba do CROAMIS!");
          }
        });
      };

      // Inicia as tentativas após a duplicação
      setTimeout(() => tentarEnviar(), 1500);
    });
  });
}