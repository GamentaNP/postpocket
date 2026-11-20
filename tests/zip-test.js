require('../src/shared/zip.js');
(async function () {
  var entries = [
    { name: 'folder/photo.jpg', data: new Uint8Array([1, 2, 3, 4, 5]) },
    { name: 'folder/post-info.json', data: '{"ok":true}' }
  ];
  var blob = globalThis.PPZip.createZip(entries);
  var out = await globalThis.PPZip.readZip(await blob.arrayBuffer());
  console.log('zip bytes:', blob.size, 'entries:', out.length);
  out.forEach(function (e) {
    console.log(e.name, '=>', new TextDecoder().decode(e.data).slice(0, 30));
  });
  if (out.length !== 2 || new TextDecoder().decode(out[1].data) !== '{"ok":true}') process.exit(1);
})().catch(function (e) { console.error(e); process.exit(1); });
