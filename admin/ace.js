/*
|--------------------------------------------------------------------------
| Ponto de entrada JavaScript para executar comandos do Ace
|--------------------------------------------------------------------------
|
| NÃO MODIFIQUE ESTE ARQUIVO, POIS ELE SERÁ SOBRESCRITO DURANTE O
| PROCESSO DE COMPILAÇÃO.
|
| Consulte docs.adonisjs.com/guides/typescript-build-process#creating-production-build
|
| Como não podemos executar código-fonte TypeScript usando o executável
| "node", precisamos de um ponto de entrada JavaScript para executar os comandos do Ace.
|
| Este arquivo registra o hook "ts-node/esm" no sistema de módulos do Node.js
| e, em seguida, importa o arquivo "bin/console.ts".
|
*/

/**
 * Registra o hook para processar arquivos TypeScript usando o ts-node-maintained.
 */
import 'ts-node-maintained/register/esm'

/**
 * Importa o ponto de entrada do console do Ace.
 */
await import('./bin/console.js')
