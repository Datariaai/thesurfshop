// Datos de la tienda pública (index.html). Es lo único que hay que tocar para cambiar el WhatsApp o los precios.

(function () {
const TIENDA = {
  // WhatsApp de los pedidos: código de país + número, sin espacios ni "+".
  whatsapp: '5491165089999',
  instagram: 'thesurfshop.ar',

  // Precio de cada modelo en pesos, por el id de js/catalogo-inicial.js.
  // Si un modelo no tiene precio, la web muestra "Consultar" y el pedido sale igual por WhatsApp.
  precios: {
    // 'bb-gold-dots': 45000,
  },

  // Modelos que no se muestran en la web (por ejemplo, porque se agotaron).
  ocultos: [],
};

window.TSS = Object.assign(window.TSS || {}, { TIENDA });
})();
