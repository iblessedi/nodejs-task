const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

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

router.get('/multiple', async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.write('{');
  let firstResultWasAdded = false;
  const urlsToProcess = Object.entries(req.query);
  for await (const entry of urlsToProcess) {
    try {
      if (entry[0] && entry[1]) {
        const isInternalCall = entry[1].match(/^\//);
        const urlToFetch = isInternalCall ? `http://localhost:3000${entry[1]}` : entry[1]; // let's check if that's internal or external url
        let urlResult;
        try {
          urlResult = await fetch(urlToFetch);
        } catch (e) {
          const errorResponse = {
            error: {
              status: null,
              response: e.message,
            }
          }
          res.write(`${firstResultWasAdded ? ',' : ''}"${entry[0]}":${JSON.stringify(errorResponse)}`);
          firstResultWasAdded = true;
          continue;
        }
        if (urlResult.status === 200) {
          res.write(`${firstResultWasAdded ? ',' : ''}"${entry[0]}":{"data":${isInternalCall ? '' : '"'}`);
          for await (const chunk of urlResult.body) {
            res.write(isInternalCall ? chunk.toString() : chunk.toString().replace(/\r?\n|\r|\\/g, '').replace(/"/g, /\"/));
          }
          res.write(`${isInternalCall ? '' : '"'}}`);
        } else {
          const errorResponse = {
            error: {
              status: urlResult.status,
              response: {
                message: await urlResult.text(),
              }
            }
          }
          res.write(`${firstResultWasAdded ? ',' : ''}"${entry[0]}":${JSON.stringify(errorResponse)}`);
        }
        firstResultWasAdded = true;
      }
    } catch (e) {
      console.log('An error occurred while processing /multiple entry', entry);
    }
  }
  res.write('}');
  return res.end();
});

router.get('/5gb-file', function(req, res, next) {
  const fileStream = fs.createReadStream('./data/5gb-data.json');
  res.setHeader('Content-Type', 'application/json');
  fileStream.pipe(res);
});

module.exports = router;
