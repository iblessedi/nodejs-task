const assert = require('assert');
const request = require('supertest');
const http = require('http');
const nock = require('nock');
const fs = require('fs');
const faker = require('@faker-js/faker');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const appFnc = require('../app');

let app;
let server;
const largeFileName = './data/5gb-data.json'
const numberOfDataItemsIn5Gb = 50500; // this is enough to generate 5GB file

const generateLargeFile = async () => {
  try {
    let i, item;
    const response = await fetch('https://en.wikipedia.org/wiki/WalkMe');
    const bigTextResponse = await response.text();
    const bigText = JSON.stringify(await bigTextResponse.replace(/[\n"\&\r\t\b\f]/g, '\\$&'));
    console.log('Generating data for large test file. Please, be patient...')
    const stream = fs.createWriteStream(largeFileName, { flags: 'w' });
    stream.write('{');
    for (i = 0; i < numberOfDataItemsIn5Gb; i++) {
      const age = Math.floor(Math.random() * 99);
      item = `"id${i + 1}": {"name": "${escape(faker.name.firstName())} ${escape(faker.name.lastName())}", "id": "${i + 1}", "age": "${age}", "text": ${bigText}}`;
      item += i < numberOfDataItemsIn5Gb - 1 ? ',' : '';
      stream.write(item);
    }
    stream.write('}');
    stream.close();
    return new Promise(resolve => stream.on('finish', () => resolve()));
  } catch (e) {
    console.log('Error while generating large file', e);
    assert.fail('Couldn\'t generate large file');
  }
};

const removeLargeFile = () => {
  fs.unlinkSync(largeFileName);
};

describe('app tests', () => {
  before(async () => {
    try {
      await generateLargeFile();
      app = await appFnc(); // we need to launch server, because we use it for external requests while testing
      server = await http.createServer(app);
      server.listen(3000);
    } catch (e) {
      console.log('Error while launching web server', e);
      assert.fail('Couldn\'t prepare tests for start');
    }
  });
  after(() => {
    try {
      server.close();
      removeLargeFile();
    } catch (e) {
      console.log('Error while closing web server', e);
      assert.fail('Couldn\'t do the cleanup job');
    }
  });

  describe('testing /customers endpoint', () => {
    it('should return 404 on customer which does not exist', (done) => {
      request(app)
        .get('/customers/999')
        .expect(404)
        .expect('customer doesn\'t exist')
        .end(done);
    });
    it('should return customer which exists', (done) => {
      request(app)
        .get('/customers/1')
        .expect(200)
        .expect(function (response) {
          assert.deepEqual(response.body, {
            name: 'Bob',
            id: '1',
            age: '21',
          });
        })
        .end(done);
    });
  });

  describe('testing /products endpoint', () => {
    it('should return 404 on product which does not exist', (done) => {
      request(app)
        .get('/products/999')
        .expect(404)
        .expect('product doesn\'t exist')
        .end(done);
    });
    it('should return product which exists', (done) => {
      request(app)
        .get('/products/1')
        .expect(200)
        .expect((response) => {
          assert.deepEqual(response.body, {
            name: 'Heinz',
            id: '1',
            price: '100',
          });
        })
        .end(done);
    });
  });

  describe('testing /multiple endpoint', () => {
    const checkRecord = (obj, params) => {
      assert(typeof obj === 'object');
      Object.entries(params).forEach((param) => {
        assert(obj.data[param[0]] === param[1]);
      });
    }

    it('fetching 1 customer, 1 product, all results successful', (done) => {
      request(app)
        .get('/multiple?bob=/customers/1&heinz=/products/1')
        .expect(200)
        .expect((response) => {
          assert(Object.keys(response.body).length === 2);
          checkRecord(response.body.bob, { name: 'Bob', id: '1', age: '21' });
          checkRecord(response.body.heinz, { name: 'Heinz', id: '1', price: '100' });
        })
        .end(done);
    });

    it('fetching 1 customer, 1 product, all 404', (done) => {
      request(app)
        .get('/multiple?bob=/customers/100&heinz=/products/100')
        .expect(200)
        .expect((response) => {
          assert(Object.keys(response.body).length === 2);

          assert(typeof response.body.bob === 'object')
          assert(response.body.bob.error.status === 404);
          assert(response.body.bob.error.response.message === 'customer doesn\'t exist');

          assert(typeof response.body.heinz === 'object')
          assert(response.body.heinz.error.status === 404);
          assert(response.body.heinz.error.response.message === 'product doesn\'t exist');
        })
        .end(done);
    });

    it('fetching 1 customer, 2 external links, all are successful', (done) => {
      request(app)
        .get('/multiple?bob=/customers/1&google=https://google.com&facebook=https://facebook.com')
        .expect(200)
        .expect((response) => {
          assert(Object.keys(response.body).length === 3);
          checkRecord(response.body.bob, { name: 'Bob', id: '1', age: '21' });
          assert(response.body.google.data.length > 5000);
          assert(response.body.facebook.data.length > 5000);
        })
        .end(done);
    });

    it('fetching 1 successful, 1 with error', (done) => {
      request(app)
        .get('/multiple?google=https://google.com&badone=https://notexisten.com')
        .expect(200)
        .expect((response) => {
          assert(Object.keys(response.body).length === 2);
          assert(response.body.google.data.length > 5000);
          assert(response.body.badone.error.response === 'request to https://notexisten.com/ failed, reason: getaddrinfo ENOTFOUND notexisten.com');
        })
        .end(done)
    });

    it('running test with 5gb+ sub response', async () => {
      let pageUrl = 'http://localhost:3000/multiple?bob=/customers/1&large=/5gb-file';
      try {
        const resultFile = './data/result.json';
        const urlResult = await fetch(pageUrl);
        const stream = fs.createWriteStream(resultFile, { flags: 'w' });
        for await (const chunk of urlResult.body) {
          stream.write(chunk);
        }
        stream.close();
        await new Promise(resolve => stream.on('finish', () => resolve()));
        assert(urlResult.status === 200);
        const fileStats = fs.statSync(resultFile);
        assert(fileStats.size > 8 * 1024 * 1024 * 5);
        fs.unlinkSync(resultFile);
      } catch (e) {
        console.log('Couldn\'t fetch 5 gb of data', e);
        assert.fail('Couldn\'t fetch 5gb of data');
      }
    });

    it('simulating local server is not responding', (done) => {
      const errorMessage = 'Server error';
      nock('http://localhost:3000').get('/customers/1').reply(500, errorMessage);
      request(app)
        .get('/multiple?bob=/customers/1&google=https://google.com')
        .expect(200)
        .expect((response) => {
          assert(response.body.bob.error.response.message === errorMessage);
          assert(response.body.google.data.length > 5000);
        })
        .end(done);
    });
  });
});
