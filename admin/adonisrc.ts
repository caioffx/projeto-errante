import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Recursos experimentais
  |--------------------------------------------------------------------------
  |
  | Os recursos a seguir serão habilitados por padrão na próxima versão
  | principal do AdonisJS. Você pode ativá-los desde já para evitar
  | alterações incompatíveis durante a atualização.
  |
  */
  experimental: {
    mergeMultipartFieldsAndFiles: true,
    shutdownInReverseOrder: true,
  },

  /*
  |--------------------------------------------------------------------------
  | Comandos
  |--------------------------------------------------------------------------
  |
  | Lista de comandos do Ace a serem registrados a partir dos pacotes.
  | Os comandos da aplicação serão detectados automaticamente no diretório
  | "./commands".
  |
  */
  commands: [() => import('@adonisjs/core/commands'), () => import('@adonisjs/lucid/commands')],

  /*
  |--------------------------------------------------------------------------
  | Provedores de serviços
  |--------------------------------------------------------------------------
  |
  | Lista de provedores de serviços a serem importados e registrados durante
  | a inicialização da aplicação.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/core/providers/edge_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/vite/vite_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/static/static_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/inertia/inertia_provider'),
    () => import('@adonisjs/transmit/transmit_provider'),
    () => import('#providers/map_static_provider'),
    () => import('#providers/kiwix_migration_provider'),
    () => import('#providers/qdrant_restart_policy_provider'),
    () => import('#providers/version_check_provider'),
    () => import('#providers/gpu_passthrough_remediation_provider'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Carregamento antecipado
  |--------------------------------------------------------------------------
  |
  | Lista de módulos a serem importados antes de iniciar a aplicação.
  |
  */
  preloads: [() => import('#start/routes'), () => import('#start/kernel')],

  /*
  |--------------------------------------------------------------------------
  | Testes
  |--------------------------------------------------------------------------
  |
  | Lista de conjuntos de testes organizados por tipo. Você pode remover
  | ou adicionar conjuntos conforme necessário.
  |
  */
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec(.ts|.js)'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec(.ts|.js)'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },

  /*
  |--------------------------------------------------------------------------
  | Arquivos adicionais
  |--------------------------------------------------------------------------
  |
  | Conjunto de arquivos que devem ser copiados para a pasta de compilação
  | ao gerar a versão de produção.
  |
  */
  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    },
    {
      pattern: 'resources/geodata/**/*.geojson',
      reloadServer: false,
    },
    {
      pattern: 'public/**',
      reloadServer: false,
    },
  ],

  assetsBundler: false,
  hooks: {
    onBuildStarting: [() => import('@adonisjs/vite/build_hook')],
  },
})
