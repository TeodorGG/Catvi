/* Passenger/Plesk startup file.
   `next start` is a CLI entry point and cannot be used by Passenger, which
   needs a file that calls listen() itself. Not processed by the Next.js
   compiler, so keep this plain CommonJS. `npm start` still uses `next start`
   for Docker and local runs; only Plesk points at this file. */
const { createServer } = require("node:http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => handle(req, res));
    // Measurement uploads are bounded by the API, not here; keep the frontend
    // timeouts above Nginx's so the proxy decides when a request is too slow.
    server.requestTimeout = 95000;
    server.listen(port, () =>
      console.log(`CATVI frontend ready on port ${port}`),
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
