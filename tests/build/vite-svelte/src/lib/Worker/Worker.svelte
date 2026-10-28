<script lang="ts">
  import EchoWorker from './echo.js?worker';

  let viaUrl = $state('waiting');
  let viaImport = $state('waiting');
  const byUrl = new Worker(new URL('./echo.js', import.meta.url), { type: 'module' });
  byUrl.onmessage = (e) => (viaUrl = e.data);
  byUrl.onerror = () => (viaUrl = 'error');
  const byImport = new EchoWorker();
  byImport.onmessage = (e) => (viaImport = e.data);
  byImport.onerror = () => (viaImport = 'error');
</script>

<output id="via-url">{viaUrl}</output>
<output id="via-import">{viaImport}</output>
