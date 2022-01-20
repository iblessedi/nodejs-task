const assert = require('assert');
const request = require('supertest');
const http = require('http');
const nock = require('nock');
const fs = require('fs');
const faker = require('@faker-js/faker');
const appFnc = require('../app');

let app;
let server;

describe('app tests', () => {
  before(async () => {
    try {
      app = await appFnc(); // we need to launch server, because we use it for external requests while testing
      server = http.createServer(app);
      server.listen(3000);
    } catch (e) {
      console.log('Error while launching web server', e);
      assert.fail('Couldn\'t start server');
    }
  });
  after(() => {
    try {
      server.close();
    } catch (e) {
      console.log('Error while closing web server', e);
      assert.fail('Couldn\'t stop server');
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

    it('fetching 1 customer, 2 external links, all aresuccessful', (done) => {
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
          assert(response.body.badone.error.response === 'getaddrinfo ENOTFOUND notexisten.com');
        })
        .end(done)
    });

    it('simulating local server is not responding', (done) => {
      // we set 5000 timeout for axios, so it will drop connection before the server responds
      nock('http://localhost:3000').get('/customers/1').delayConnection(6000).reply(500);
      request(app)
        .get('/multiple?bob=/customers/1&google=https://google.com')
        .expect(200)
        .expect((response) => {
          assert(response.body.bob.error.response.message === 'timeout of 5000ms exceeded');
          assert(response.body.google.data.length > 5000);
        })
        .end(done);
    });
  });
});
