import { LocalstackContainer } from "@testcontainers/localstack";

async function run() {
  console.log("Starting container...");
  const container = await new LocalstackContainer().start();
  console.log("URI:", container.getConnectionUri());
  await container.stop();
  console.log("Stopped.");
}

run().catch(console.error);
