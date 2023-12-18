const messaggi = require("../Utilità/scheletro_messaggi");


module.exports.impossibile_cancellare = (trigger) =>{
    let testo_query= "Woops\n\nIl messaggio è troppo vecchio perché possa cancellarlo…";

    return { 
        risposta_callback:  messaggi.risposta_callback(trigger, testo_query, true),
        modifica_tastiera: messaggi.modifica_tastiera(trigger)
    }
}

module.exports.cancella = (trigger) =>{
    let testo_query= "Ok…";

    return { 
        risposta_callback:  messaggi.risposta_callback(trigger, testo_query),
        cancella: messaggi.cancella(trigger)
    }
}