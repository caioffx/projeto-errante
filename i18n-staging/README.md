# 🌐 Diretório Staging de Internacionalização (i18n)

Este diretório contém as versões prontas com **internacionalização (i18n)** aplicada aos componentes, layouts e telas do frontend, **sem alterar ou sobrescrever os arquivos originais** do projeto.

---

## 📁 Estrutura de Arquivos neste Staging

```
i18n-staging/
├── README.md                          <-- Esta documentação
├── locales/                           <-- Dicionários de tradução (en e pt-BR)
│   ├── en/
│   │   ├── common.json
│   │   ├── settings.json
│   │   ├── docs.json
│   │   ├── home.json
│   │   ├── errors.json
│   │   └── easy_setup.json
│   └── pt-BR/
│       ├── common.json
│       ├── settings.json
│       ├── docs.json
│       ├── home.json
│       ├── errors.json
│       └── easy_setup.json
├── layouts/                           <-- Layouts globais traduzidos
│   ├── AppLayout.tsx
│   ├── SettingsLayout.tsx
│   ├── DocsLayout.tsx
│   └── MapsLayout.tsx
├── pages/                             <-- Telas traduzidas
│   ├── home.tsx
│   ├── easy-setup/
│   │   ├── index.tsx                  <-- Assistente de Configuração Rápida completo
│   │   └── complete.tsx
│   └── errors/
│       ├── not_found.tsx
│       └── server_error.tsx
└── components/                        <-- Componentes reutilizáveis traduzidos
    ├── StyledSidebar.tsx
    ├── Alert.tsx
    ├── StyledModal.tsx
    ├── LoadingSpinner.tsx
    ├── DebugInfoModal.tsx
    ├── CategoryCard.tsx
    ├── InstallActivityFeed.tsx
    ├── CountryPickerModal.tsx
    ├── WikipediaSelector.tsx
    ├── TierSelectionModal.tsx
    └── layout/
        └── BackToHomeHeader.tsx
```

---

## 🔍 Como comparar com os arquivos originais

Você pode usar o comando `diff` no terminal para inspecionar exatamente o que mudou em relação ao original:

```bash
# Comparar a tela Home/Dashboard
diff -u admin/inertia/pages/home.tsx i18n-staging/pages/home.tsx

# Comparar o Wizard do Easy Setup
diff -u admin/inertia/pages/easy-setup/index.tsx i18n-staging/pages/easy-setup/index.tsx

# Comparar o CountryPickerModal
diff -u admin/inertia/components/CountryPickerModal.tsx i18n-staging/components/CountryPickerModal.tsx
```

---

## 🚀 Como promover/aplicar para o projeto oficial quando desejar

Quando quiser aplicar os arquivos traduzidos na aplicação oficial, basta copiar as pastas:

```bash
# 1. Copiar layouts
cp i18n-staging/layouts/* admin/inertia/layouts/

# 2. Copiar páginas
cp i18n-staging/pages/home.tsx admin/inertia/pages/
cp -r i18n-staging/pages/easy-setup admin/inertia/pages/
cp -r i18n-staging/pages/errors admin/inertia/pages/

# 3. Copiar componentes
cp i18n-staging/components/*.tsx admin/inertia/components/
cp i18n-staging/components/layout/*.tsx admin/inertia/components/layout/

# 4. Validar sincronia de chaves de tradução
npm --prefix admin run i18n:check
```
