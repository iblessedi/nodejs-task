const express = require('express');
const axios = require('axios');
const router = express.Router();

const customers = require('../data/customers.json');
const products = require('../data/products.json');
const data = { customers, products };

const processSimpleRequest = (section, req, res) => {
  try {
    const {id} = req.params;
    return id && data[section][id] ? res.json(data[section][id]) : res.status(404).send(`${section.replace(/s$/, '')} doesn't exist`);
  } catch (e) {
    console.log(`An error occurred while processing ${req.url} request`, e);
    return res.status(500).send('500 - Internal Error Occurred');
  }
};

router.get('/customers/:id', function(req, res, next) {
  return processSimpleRequest('customers', req, res);
});

router.get('/products/:id', function(req, res, next) {
  return processSimpleRequest('products', req, res);
});

router.get('/multiple', function(req, res, next) {
  return Promise.all(Object.entries(req.query).map((entry) => {
    if (entry[0] && entry[1]) {
      const isInternalCall = entry[1].match(/^\//);
      const urlToFetch = isInternalCall ? `http://localhost:3000${entry[1]}` : entry[1]; // let's check if that's internal or external url
      return axios.get(urlToFetch, { timeout: 5000 })
        .then(urlResult => {
          return { [entry[0]]: { data: urlResult.data } };
        })
        .catch((e) => {
          const message = e.response? e.response.data : e.message;
          return {
            [entry[0]]: {
              error: {
                status: e.response ? e.response.status : null,
                response: isInternalCall ? {
                  message,
                } : message
              }
            }
          };
        });
    }
  })).then((results) => {
    return res.json(results.reduce((obj, item) => {
      const key = Object.keys(item)[0]
      obj[key] = item[key]
      return obj
    }, {}));
  })
    .catch((e) => {
      console.log(`An error occurred while processing ${req.url} request`, e);
      return res.status(500).send('500 - Internal Error Occurred');
    });
});

module.exports = router;
