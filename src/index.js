// @see https://github.com/redux-effects/redux-effects-fetch/blob/master/src/index.js
import {FETCH} from 'redux-effects-fetch';
import URL from 'url-parse';
import {trimStart} from 'lodash/string';
import {noop} from 'lodash/util';

/**
 * == Fetch middleware ==
 *
 * Provides offline fixtures for dev mode. Intercepts all FETCH
 * actions and responses with fixtures defined in this file.
 */
export default function localFetchMiddleware(fixtures) {
  return () => next => action =>
    action.type === FETCH
      ? resolveFixture(fixtures, action.payload.url, action.payload.params.method || 'GET', action.payload.params.body)
      : next(action);
}

/*eslint-disable  no-console */
const resolveFixture = (fixtures, urlPath, method, body) => {
  const url = new URL(`http://localhost${urlPath}`);
  const helpMessage = 'Add a new fixture!';

  const logBuffer = [];
  logBuffer.push(() => console.group('%c API Requests served by local fixtures', 'color: #08088A'));
  logBuffer.push(() => console.info(`%c[${method}] %c${url.pathname}`, 'color: #380B61', 'color: #000000'));

  const isGET = method === 'GET';

  if (isGET) {
    logBuffer.push(() => console.info('%c[PARAMS]', 'color: #380B61', trimStart(url.query, '?')));
  } else {
    logBuffer.push(() => console.info('%c[BODY]', 'color: #380B61', JSON.parse(body)));
  }

  const endpoint = fixtures[url.pathname];
  if (endpoint === undefined) {
    logBuffer.push(() => console.groupEnd());
    evalLogBuffer(logBuffer);
    throw new Error(`No fixture provided for url: ${url.pathname}. ${helpMessage}`);
  }

  const methodFixture = endpoint[method];
  if (methodFixture === undefined) {
    logBuffer.push(() => console.groupEnd());
    evalLogBuffer(logBuffer);
    throw new Error(`No fixture provided for [${method}] method. ${helpMessage}`);
  }

  const bodyOrQuery = isGET ? trimStart(url.query, '?') : body;
  const delegate = (...args) => resolveFixture(fixtures, ...args);
  const result = methodFixture(bodyOrQuery, delegate);

  result.then(
    result => {
      logBuffer.push(() => console.info('%c[RESULT]', 'color: #298A08', result));
      logBuffer.push(() => console.groupEnd());
    }
  ).catch(error => {
    logBuffer.push(() => console.info('%c[ERROR]', 'color: #DF0101', error));
    logBuffer.push(() => console.groupEnd());
  }).then(() => evalLogBuffer(logBuffer));
  return result;
};
/*eslint-enable */

// buffer is an array of functions
const evalLogBuffer = buffer => buffer.forEach(log => log());

/**
 * Builds a 200 OK response object mimicking the fetch middleware.
 * @param value the deserialized json object
 */
const ok = (value = {}) => {
  return Promise.resolve({
    status: 200,
    statusText: 'OK',
    value: value
  });
};

const okDelayed = (value = {}, delay = 500) => {
  return new Promise(resolve => {
    setTimeout(() => resolve({
      status: 200,
      statusText: 'OK',
      value: value
    }), delay);
  });
};

/**
 * Builds a simple error object mimicking the fetch middleware.
 */
const error = (message) => {
  return Promise.reject(new Error(message));
};

const httpErrorResponse = (statusCode, statusText) => (kind, message) => {
  const promise = Promise.reject({
    status: statusCode,
    statusText: statusText,
    value: {
      kind: kind,
      message: message
    }
  });
  // Register a catch handler to avoid log messages about uncaught errors in promises
  promise.catch(noop);
  return promise;
};

const internalServerError = httpErrorResponse(500, 'Internal Server Error')(null, null);
const notFound = httpErrorResponse(404, 'Not Found');
const unauthorized = httpErrorResponse(401, 'Unauthorized');

export const responses = {
  ok,
  okDelayed,
  error,
  internalServerError,
  notFound,
  unauthorized
};
