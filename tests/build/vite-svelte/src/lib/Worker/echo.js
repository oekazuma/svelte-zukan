// an emitted asset the worker loads by its URL, which the catalog build moves with the worker
import message from './message.txt?url&no-inline';

fetch(message)
  .then((r) => r.text())
  .then((text) => self.postMessage(text.trim()));
