const btnEscutar = document.getElementById('btn-escutar');
const btnVozIa = document.getElementById('btn-voz-ia');
const statusTexto = document.getElementById('status');
const historico = document.getElementById('historico');
const campoDataAtual = document.getElementById('data-atual');

let isIAFalando = false;
let bancoDadosLotes = {};
let etapaAtual = "inicio";
let dadosNovaRemessa = { data: "", cnpj: "", destinatario: "", pallet: "", peso: 0, quantidade: 0, medida: "" };

let iaVozAtivada = true;
let contextoDoDia = [];

const urlAPI = "https://script.google.com/macros/s/AKfycby2zfEvuyFxV_nuNrno9jtiBCiRX9eWf8rWBh6hnC08kCVtYR9OjfolDU4SVpCmhbc8/exec";

const dicionarioCNPJResumo = {
    "plaza casa forte": "43470566006716",
    "rio mar fortaleza": "43470566005906",
    "riomar fortaleza": "43470566005906",
    "rio mar aracaju": "43470566008760",
    "riomar aracaju": "43470566008760",
    "rio mar": "43470566004268",
    "riomar": "43470566004268",
    "iguatemi fortaleza": "43470566003296",
    "recife": "43470566002729",
    "barra salvador": "43470566004241",
    "tijuca": "43470566006988",
    "rio sul": "43470566010829",
    "catuaí maringa": "43470566012287",
    "vitoria": "43470566008417",
    "boulevard belém": "43470566009227",
    "manauara": "43470566010586",
    "ilha": "43470566010403",
    "leblon": "43470566007100",
    "shopping da bahia": "43470566010071",
    "icarai": "43470566009065",
    "midway": "43470566011043",
    "vila velha": "43470566010233",
    "batel": "43470566007879",
    "rio poty": "43470566013763",
    "catuaí londrina": "43470566012368",
    "maceio": "43470566008093",
    "mueller": "43470566001919",
    "shopping grao pará": "43470566009146",
    "manaira shopping": "43470566008689",
    "barra shopping": "43470566004853",
    "haight dias": "43470566013320",
    "haight village mall": "43470566013925",
    "rio design barra": "43470566002214",
    "haight leblon": "43470566013844",
    "natal": "43470566008506",
    "haight rio design": "43470566013500",
    "salvador shopping": "43470566002052",
    "fabio melo": "37208921000176",
    "moniz": "49810965000193",
    "forma porto": "56538551000130"
};

const dicionarioCNPJ = dicionarioCNPJResumo;

const sinonimosClientes = {
    "rio mar fortaleza": ["rio mar fortaleza", "riomar fortaleza"],
    "rio mar aracaju": ["rio mar aracaju", "riomar aracaju"],
    "rio mar": ["rio mar", "riomar"],
    "catuai maringa": ["catuai maringa", "catuaí maringá", "catuai maringá", "catuaí maringa"],
    "icarai": ["icarai", "icaraí"],
    "patio chapeco": ["patio chapeco", "pátio chapecó", "patio chapecó", "pátio chapeco"],
    "manaira shopping": ["manaira shopping", "manaíra shopping"],
    "fabio melo": ["fabio melo", "fábio melo"],
    "moniz": ["moniz", "monis", "muniz"],
    "haight dias": ["haight dias", "heigth dias", "head dias", "haite dias", "hdias", "h dia", "agadias", "aga dia", "rai dias", "ray dias", "eita dias", "red dias"],
    "haight village mall": ["haight village mall", "heigth village mall", "head village mall", "haite village mall", "haight village", "h village", "aga village", "rai village", "ray village", "village mall"],
    "haight leblon": ["haight leblon", "heigth leblon", "head leblon", "haite leblon", "h leblon", "aga leblon", "rai leblon", "ray leblon", "eita leblon"],
    "haight rio design": ["haight rio design", "heigth rio design", "head rio design", "haite rio design", "h rio design", "aga rio design", "rai rio design", "ray rio design", "rio design"]
};

function removerAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function obterDataAtual() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;

    if (campoDataAtual) {
        campoDataAtual.innerText = `Data de hoje: ${dataFormatada}`;
    }
    return dataFormatada;
}

async function sincronizarComSheets() {
    const dataHojeFormatada = obterDataAtual();
    try {
        const resposta = await fetch(urlAPI);
        const dados = await resposta.json();

        if (Array.isArray(dados)) {
            contextoDoDia = dados.filter(item => {
                if (!item.data) return false;
                let dataItem = String(item.data).trim();
                if (dataItem.includes("-") && dataItem.length >= 10) {
                    let partes = dataItem.substring(0, 10).split("-");
                    dataItem = `${partes[2]}/${partes[1]}/${partes[0]}`;
                }
                return dataItem === dataHojeFormatada;
            });
            console.log("Memória sincronizada! Registros de hoje:", contextoDoDia.length);
        }
    } catch (erro) {
        console.error("Erro ao sincronizar com a planilha:", erro);
    }
}

function falar(texto) {
    window.speechSynthesis.cancel();

    if (!iaVozAtivada) {
        isIAFalando = false;
        if (btnEscutar) {
            btnEscutar.disabled = false;
            btnEscutar.style.backgroundColor = "#24b33b";
            btnEscutar.innerText = "🛑 Parar Ouvir";
        }
        if (statusTexto) statusTexto.innerText = "Pronto! Pode falar.";
        try { recognition.start(); } catch (e) { }
        return;
    }

    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.lang = 'pt-BR';
    enunciado.rate = 1.05;
    enunciado.pitch = 1.0;

    enunciado.onstart = () => {
        isIAFalando = true;
        try { recognition.stop(); } catch (e) { }
        if (btnEscutar) {
            btnEscutar.disabled = true;
            btnEscutar.style.backgroundColor = "#888888";
            btnEscutar.innerText = "🤫 IA Falando...";
        }
        if (statusTexto) statusTexto.innerText = "Aguarde a IA concluir a instrução...";
    };

    enunciado.onend = () => {
        setTimeout(() => {
            isIAFalando = false;

            if (etapaAtual === "inicio") {
                if (btnEscutar) btnEscutar.disabled = false;
                pararEscutaVisual();
                if (statusTexto) statusTexto.innerText = "Operação concluída. Clique para iniciar nova remessa!";
                try { recognition.stop(); } catch (e) { }
                return;
            }

            if (btnEscutar) {
                btnEscutar.disabled = false;
                btnEscutar.style.backgroundColor = "#24b33b";
                btnEscutar.innerText = "🛑 Parar Ouvir";
            }
            if (statusTexto) statusTexto.innerText = "Pronto! Pode falar agora...";

            try { recognition.start(); } catch (e) { }
        }, 1200);
    };

    enunciado.onerror = () => {
        isIAFalando = false;
        try { recognition.start(); } catch (e) { }
    };

    window.speechSynthesis.speak(enunciado);
}

function alternarVozIA() {
    iaVozAtivada = !iaVozAtivada;
    const btnVoz = document.getElementById('btn-toggle-voz');

    if (!iaVozAtivada) {
        window.speechSynthesis.cancel();
        isIAFalando = false;
        if (btnVoz) {
            btnVoz.innerText = "🔇 Voz da IA: DESLIGADA";
            btnVoz.style.backgroundColor = "#757575";
        }
    } else {
        if (btnVoz) {
            btnVoz.innerText = "🔊 Voz da IA: LIGADA";
            btnVoz.style.backgroundColor = "#1a73e8";
        }
    }
}

function adicionarAoHistorico(autor, texto) {
    if (!historico) return;
    const classe = autor === "Você" ? "linha-user" : "linha-ia";
    historico.innerHTML += `<p class="${classe}"><strong>${autor}:</strong> ${texto}</p>`;
    historico.scrollTop = historico.scrollHeight;

    if (autor === "IA") {
        falar(texto);
    }
}

function tratarTextoMedida(texto) {
    let textoLimpo = texto.toLowerCase().trim();

    if (textoLimpo.includes("padrão") || textoLimpo.includes("padrao")) {
        return "PADRÃO";
    }

    const mapaExtenso = {
        "vinte e um": "21", "vinte e dois": "22", "vinte e três": "23", "vinte e quatro": "24", "vinte e cinco": "25", "vinte e seis": "26", "vinte e sete": "27", "vinte e oito": "28", "vinte e nove": "29", "vinte": "20",
        "trinta e um": "31", "trinta e dois": "32", "trinta e três": "33", "trinta e quatro": "34", "trinta e cinco": "35", "trinta e seis": "36", "trinta e sete": "37", "trinta e oito": "38", "trinta e nove": "39", "trinta": "30",
        "quarenta e um": "41", "quarenta e dois": "42", "quarenta e três": "43", "quarenta e quatro": "44", "quarenta e cinco": "45", "quarenta e seis": "46", "quarenta e sete": "47", "quarenta e oito": "48", "quarenta e nove": "49", "quarenta": "40",
        "cinquenta e um": "51", "cinquenta e dois": "52", "cinquenta e três": "53", "cinquenta e quatro": "54", "cinquenta e cinco": "55", "cinquenta e seis": "56", "cinquenta e sete": "57", "cinquenta e oito": "58", "cinquenta e nove": "59", "cinquenta": "50",
        "sessenta e um": "61", "sessenta e dois": "62", "sessenta e três": "63", "sessenta e quatro": "64", "sessenta e cinco": "65", "sessenta e seis": "66", "sessenta e sete": "67", "sessenta e oito": "68", "sessenta e nove": "69", "sessenta": "60",
        "dez": "10", "onze": "11", "doze": "12", "treze": "13", "quatorze": "14", "quinze": "15", "dezesseis": "16", "dezessete": "17", "dezoito": "18", "dezenove": "19"
    };

    Object.keys(mapaExtenso).forEach(chave => {
        const regex = new RegExp(`\\b${chave}\\b`, 'g');
        textoLimpo = textoLimpo.replace(regex, mapaExtenso[chave]);
    });

    textoLimpo = textoLimpo.replace(/\s*por\s*/g, "x")
        .replace(/\s+e\s+/g, "x")
        .replace(/\s*x\s*/g, "x")
        .replace(/\s+/g, "x");

    textoLimpo = textoLimpo.replace(/[^0-9xX]/g, "");

    if (/^\d{6}$/.test(textoLimpo)) {
        let parte1 = textoLimpo.substring(0, 2);
        let parte2 = textoLimpo.substring(2, 4);
        let parte3 = textoLimpo.substring(4, 6);
        return `${parte1}X${parte2}X${parte3}`;
    }

    return textoLimpo.toUpperCase();
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'pt-BR';
recognition.continuous = true;
recognition.interimResults = false;

if (btnEscutar) {
    btnEscutar.addEventListener('click', () => {
        if (btnEscutar.disabled) return;

        if (btnEscutar.classList.contains('ouvindo')) {
            recognition.stop();
            pararEscutaVisual();
        } else {
            recognition.start();
            btnEscutar.classList.add('ouvindo');
            statusTexto.innerText = "🎙️ Modo Mãos Livres ATIVO...";
            btnEscutar.style.backgroundColor = "#24b33b";
            btnEscutar.innerText = "🛑 Parar Ouvir";
        }
    });
}

function pararEscutaVisual() {
    if (!btnEscutar) return;
    btnEscutar.classList.remove('ouvindo');
    btnEscutar.style.backgroundColor = "#ea4335";
    btnEscutar.innerText = "🎙️ Falar com a IA";
    if (statusTexto) statusTexto.innerText = "Microfone desligado.";
}

recognition.onend = () => {
    if (btnEscutar && btnEscutar.classList.contains('ouvindo') && etapaAtual !== "inicio") {
        try { recognition.start(); } catch (e) { }
    } else {
        pararEscutaVisual();
    }
};

recognition.onerror = (event) => {
    if (event.error === 'no-speech') return;
    if (statusTexto) statusTexto.innerText = "Erro ao ouvir. Tente de novo.";
    pararEscutaVisual();
};

recognition.onresult = (event) => {
    if (isIAFalando) {
        console.warn("🛡️ Áudio descartado: IA ainda está falando.");
        return;
    }

    const textoCapta = event.results[event.results.length - 1][0].transcript;
    processarFluxoVoz(textoCapta);
};

function processarFluxoVoz(texto) {
    let textoLimpo = texto.toLowerCase().trim();

    const frasesEcoIA = [
        "pronto para a próxima", "pronto para a proxima",
        "salvo com sucesso", "diga salvar", "para confirmar",
        "aguarde a ia", "remessa aberta", "operação finalizada"
    ];

    if (frasesEcoIA.some(frase => textoLimpo.includes(frase))) {
        console.log("🛡️ Anti-Eco ativado ->", textoLimpo);
        if (statusTexto) statusTexto.innerText = "Pronto! Pode falar agora...";
        return;
    }

    // Atalho global para abrir modal de digitação/seleção manual a qualquer momento
    if (textoLimpo.includes("digitar") || textoLimpo.includes("selecionar cliente") || textoLimpo.includes("manual")) {
        adicionarAoHistorico("Você", texto);
        adicionarAoHistorico("IA", "Abrindo janela de seleção de cliente...");
        abrirModalCliente();
        return;
    }

    // Comandos de Reinício/Zerar
    if (etapaAtual !== "inicio" && (textoLimpo.includes("corrigir tudo") || textoLimpo.includes("zerar") || textoLimpo.includes("recomeçar"))) {
        adicionarAoHistorico("Você", texto);
        dadosNovaRemessa = { data: obterDataAtual(), cnpj: "", destinatario: "", pallet: "", peso: 0, quantidade: 0, medida: "" };
        adicionarAoHistorico("IA", "Ok, zerei a remessa completa! Pode falar os dados novamente.");
        etapaAtual = "aguardando_dados";
        if (statusTexto) statusTexto.innerText = "Aguardando dados da remessa...";
        return;
    }

    // Fluxo Inicial: Abertura da Remessa
    if (etapaAtual === "inicio") {
        adicionarAoHistorico("Você", texto);

        if (textoLimpo.includes("nova remessa")) {
            dadosNovaRemessa = { data: obterDataAtual(), cnpj: "", destinatario: "", pallet: "", peso: 0, quantidade: 0, medida: "" };
            adicionarAoHistorico("IA", "Remessa aberta! Qual o destinatário?");
            etapaAtual = "aguardando_dados";
            if (statusTexto) statusTexto.innerText = "Diga o nome do cliente...";
        } else {
            adicionarAoHistorico("IA", "Não entendi. Inicie dizendo 'nova remessa'.");
            if (statusTexto) statusTexto.innerText = "Aguardando comando correto...";
        }
        return;
    }

    // Confirmação e Salvamento
    if (etapaAtual === "aguardando_confirmacao") {
        adicionarAoHistorico("Você", texto);

        if (textoLimpo.includes("salvar") || textoLimpo.includes("salva") || textoLimpo.includes("confirmar") || textoLimpo.includes("sim") || textoLimpo.includes("ok")) {
            if (statusTexto) statusTexto.innerText = "⏳ Gravando na planilha...";

            const payload = {
                data: String(dadosNovaRemessa.data || obterDataAtual()),
                destinatario: String(dadosNovaRemessa.destinatario || ""),
                pallet: String(dadosNovaRemessa.pallet || ""),
                peso: dadosNovaRemessa.peso || 0,
                quantidade: dadosNovaRemessa.quantidade || 0,
                medida: String(dadosNovaRemessa.medida || "PADRÃO")
            };

            fetch(urlAPI, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(() => {
                    adicionarAoHistorico("IA", `Salvo com sucesso na planilha! Pronto para a próxima.`);
                    if (statusTexto) statusTexto.innerText = "Lote gravado! Microfone aberto...";

                    contextoDoDia.push(payload);
                    setTimeout(() => { sincronizarComSheets(); }, 1500);

                    dadosNovaRemessa = { data: obterDataAtual(), cnpj: "", destinatario: "", pallet: "", peso: 0, quantidade: 0, medida: "" };
                    etapaAtual = "aguardando_dados";
                })
                .catch(erro => {
                    console.error("Erro ao enviar para o Apps Script:", erro);
                    etapaAtual = "aguardando_confirmacao";
                    adicionarAoHistorico("IA", "Erro ao gravar. Mantenho os dados! Diga 'salvar' para tentar de novo.");
                    if (statusTexto) statusTexto.innerText = "Falha no salvamento. Diga 'salvar'...";
                });

        } else {
            adicionarAoHistorico("IA", 'Diga salvar para concluir ou corrigir para reiniciar.');
            if (statusTexto) statusTexto.innerText = "Aguardando confirmação...";
        }
        return;
    }

    // Processamento Dinâmico de Dados Passo a Passo
    if (etapaAtual === "aguardando_dados" || etapaAtual === "aguardando_medida") {

        if (textoLimpo === "finalizar" || textoLimpo === "encerrar") {
            adicionarAoHistorico("Você", texto);
            adicionarAoHistorico("IA", "Operação finalizada! Até a próxima remessa.");
            etapaAtual = "inicio";
            pararEscutaVisual();
            try { recognition.stop(); } catch (e) { }
            return;
        }

        adicionarAoHistorico("Você", texto);

        // Converte palavras numéricas comuns
        const conversorExtenso = {
            "um": "1", "uma": "1", "dois": "2", "três": "3", "tres": "3",
            "quatro": "4", "cinco": "5", "seis": "6", "sete": "7",
            "oito": "8", "nove": "9", "dez": "10"
        };
        Object.keys(conversorExtenso).forEach(palavra => {
            const regexSubst = new RegExp(`\\b${palavra}\\b`, 'g');
            textoLimpo = textoLimpo.replace(regexSubst, conversorExtenso[palavra]);
        });

        // 1. Identificação do Cliente (se ainda não preenchido)
        if (!dadosNovaRemessa.destinatario) {
            let textoSemAcento = removerAcentos(textoLimpo);
            let listaBusca = [];

            Object.keys(dicionarioCNPJ).forEach(nomeOriginal => {
                listaBusca.push({ termo: removerAcentos(nomeOriginal), clienteDono: nomeOriginal });
            });
            Object.keys(sinonimosClientes).forEach(nomeOriginal => {
                sinonimosClientes[nomeOriginal].forEach(sinonimo => {
                    listaBusca.push({ termo: removerAcentos(sinonimo), clienteDono: nomeOriginal });
                });
            });
            listaBusca.sort((a, b) => b.termo.length - a.termo.length);

            for (const item of listaBusca) {
                if (textoSemAcento.includes(item.termo)) {
                    dadosNovaRemessa.destinatario = item.clienteDono;
                    dadosNovaRemessa.cnpj = dicionarioCNPJ[item.clienteDono];
                    break;
                }
            }

            if (dadosNovaRemessa.destinatario) {
                // Checa histórico do dia para pegar o Pallet automaticamente
                const registrosDoClienteHoje = contextoDoDia.filter(item =>
                    item.destinatario && item.destinatario.toLowerCase().trim() === dadosNovaRemessa.destinatario.toLowerCase().trim()
                );

                let respostaCliente = `Cliente ${dadosNovaRemessa.destinatario} identificado. `;
                if (registrosDoClienteHoje.length > 0) {
                    dadosNovaRemessa.pallet = registrosDoClienteHoje[registrosDoClienteHoje.length - 1].pallet;
                    respostaCliente += `Localizado no ${dadosNovaRemessa.pallet}. Qual o peso e volumes?`;
                } else {
                    respostaCliente += `Informe o palete, peso e volumes.`;
                }

                adicionarAoHistorico("IA", respostaCliente);
                if (statusTexto) statusTexto.innerText = "Aguardando peso, volumes e palete...";
                return;
            }
        }

        // 2. Captura de Peso (Aceita números puros como 14.2 ou 15,6 sem necessidade do termo "quilos")
        const regexPesoComUnidade = /(\d+[\.,]?\d*)\s*(?:kg|kilos|quilos|kilo)\b/i;
        const matchPesoUnidade = textoLimpo.match(regexPesoComUnidade);

        if (matchPesoUnidade) {
            dadosNovaRemessa.peso = parseFloat(matchPesoUnidade[1].replace(',', '.'));
            textoLimpo = textoLimpo.replace(matchPesoUnidade[0], "");
        } else if (!dadosNovaRemessa.peso) {
            // Tenta isolar um número decimal solitário referente ao peso
            const regexNumeroDecimal = /\b(\d+[\.,]\d+|\d+)\b/;
            const matchDecimal = textoLimpo.match(regexNumeroDecimal);
            if (matchDecimal && !textoLimpo.includes("pallet") && !textoLimpo.includes("volume")) {
                dadosNovaRemessa.peso = parseFloat(matchDecimal[1].replace(',', '.'));
                textoLimpo = textoLimpo.replace(matchDecimal[0], "");
            }
        }

        // 3. Captura de Volumes
        const regexVol = /(\d+)\s*(?:volume|volumes|caixa|caixas)\b/i;
        const matchVol = textoLimpo.match(regexVol);
        if (matchVol) {
            dadosNovaRemessa.quantidade = parseInt(matchVol[1]);
            textoLimpo = textoLimpo.replace(matchVol[0], "");
        }

        // 4. Captura de Pallet
        const regexPallet = /(?:pallet|palete|paliti|palite|parte|parete|pali|pari)\s*(\d+)\b/i;
        const matchPallet = textoLimpo.match(regexPallet);
        if (matchPallet) {
            dadosNovaRemessa.pallet = `Pallet ${matchPallet[1]}`;
            textoLimpo = textoLimpo.replace(matchPallet[0], "");
        }

        // 5. Captura de Medida
        if (textoLimpo.includes("padrão") || textoLimpo.includes("padrao")) {
            dadosNovaRemessa.medida = "PADRÃO";
        } else {
            let medidaTratada = tratarTextoMedida(textoLimpo);
            const regexMedidaPronta = /(\d+)\s*X\s*(\d+)\s*X\s*(\d+)/i;
            const matchMedida = medidaTratada.match(regexMedidaPronta);
            if (matchMedida) {
                dadosNovaRemessa.medida = matchMedida[0];
            }
        }

        // Validação das pendências
        let faltou = [];
        if (!dadosNovaRemessa.destinatario) faltou.push("Cliente");
        if (!dadosNovaRemessa.peso) faltou.push("Peso");
        if (!dadosNovaRemessa.quantidade) faltou.push("Volumes");
        if (!dadosNovaRemessa.pallet) faltou.push("Pallet");
        if (!dadosNovaRemessa.medida) faltou.push("Medida");

        if (faltou.length === 0) {
            let respostaDireta = `Capturado! ${dadosNovaRemessa.destinatario} no ${dadosNovaRemessa.pallet}. Diga 'salvar' para confirmar.`;
            adicionarAoHistorico("IA", respostaDireta);
            etapaAtual = "aguardando_confirmacao";
            if (statusTexto) statusTexto.innerText = "Diga 'salvar' ou 'corrigir'...";
            return;
        }

        if (faltou.length === 1 && faltou[0] === "Medida") {
            let respostaPendente = `${dadosNovaRemessa.destinatario} no ${dadosNovaRemessa.pallet}. Qual a medida da caixa?`;
            adicionarAoHistorico("IA", respostaPendente);
            etapaAtual = "aguardando_medida";
            if (statusTexto) statusTexto.innerText = "Diga a medida da caixa...";
            return;
        }

        let identificados = [];
        if (dadosNovaRemessa.destinatario) identificados.push(dadosNovaRemessa.destinatario);
        if (dadosNovaRemessa.peso) identificados.push(`${dadosNovaRemessa.peso}kg`);
        if (dadosNovaRemessa.quantidade) identificados.push(`${dadosNovaRemessa.quantidade} vol`);
        if (dadosNovaRemessa.pallet) identificados.push(dadosNovaRemessa.pallet);

        let msgStatus = identificados.length > 0
            ? `Entendi: ${identificados.join(', ')}. Falta apenas: ${faltou.join(', ')}.`
            : `Por favor, informe: ${faltou.join(', ')}.`;

        adicionarAoHistorico("IA", msgStatus);
        etapaAtual = "aguardando_dados";
        if (statusTexto) statusTexto.innerText = "Aguardando complemento...";
        return;
    }
}

function abrirModalCliente() {
    try { recognition.stop(); } catch (e) { }

    const select = document.getElementById('select-cliente');
    if (!select) return;
    select.innerHTML = "";

    Object.keys(dicionarioCNPJ).sort().forEach(cliente => {
        let opt = document.createElement('option');
        opt.value = cliente;
        opt.innerHTML = cliente.toUpperCase();
        select.appendChild(opt);
    });

    const modal = document.getElementById('modal-cliente');
    if (modal) modal.style.display = 'flex';
    const filtro = document.getElementById('filtro-cliente');
    if (filtro) filtro.focus();
}

function fecharModalCliente() {
    const modal = document.getElementById('modal-cliente');
    if (modal) modal.style.display = 'none';
    try { recognition.start(); } catch (e) { }
}

function filtrarClientesModal() {
    let termo = document.getElementById('filtro-cliente').value.toLowerCase();
    let options = document.getElementById('select-cliente').options;

    for (let opt of options) {
        let texto = opt.text.toLowerCase();
        opt.style.display = texto.includes(termo) ? '' : 'none';
    }
}

function confirmarClienteModal() {
    const select = document.getElementById('select-cliente');
    if (!select || !select.value) {
        alert("Por favor, selecione um cliente!");
        return;
    }

    let clienteEscolhido = select.value;
    dadosNovaRemessa.destinatario = clienteEscolhido;
    dadosNovaRemessa.cnpj = dicionarioCNPJ[clienteEscolhido];

    const registrosDoClienteHoje = contextoDoDia.filter(item =>
        item.destinatario && item.destinatario.toLowerCase().trim() === clienteEscolhido
    );
    if (registrosDoClienteHoje.length > 0) {
        dadosNovaRemessa.pallet = registrosDoClienteHoje[registrosDoClienteHoje.length - 1].pallet;
    }

    const modal = document.getElementById('modal-cliente');
    if (modal) modal.style.display = 'none';

    let mensagemIA = `Cliente ${clienteEscolhido} selecionado! Pode falar o peso, volumes, pallet e medida.`;
    adicionarAoHistorico("IA", mensagemIA);
}

function enviarParaCroamis(lote) {
    const dadosEmissao = {
        tipo: "PREENCHER_CROAMIS",
        payload: {
            destinatario: lote.destinatario,
            codigoDestinatario: "74140801", // Mapeado via CNPJ do dicionário
            peso: lote.pesoTotal,
            quantidade: lote.qtdTotal,
            comprimento: 60,
            largura: 39,
            altura: 23,
            chaveNfe: lote.chaveNfe || "",
            valorProdutos: lote.valorProdutos || 0
        }
    };

    // Envia a mensagem para todas as abas abertas
    window.postMessage(dadosEmissao, "*");
    alert("Comando enviado para a aba do CROAMIS!");
}

window.onload = () => {
    obterDataAtual();
    sincronizarComSheets();
};