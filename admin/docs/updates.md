# Mantendo o NOMAD atualizado

O NOMAD funciona melhor quando é mantido atualizado enquanto você tem acesso à internet, garantindo que esteja pronto com os softwares e conteúdos mais recentes na próxima vez que você ficar offline. Esta página explica o que pode ser atualizado, como fazer isso manualmente e como permitir que o NOMAD cuide de tudo automaticamente.

---

## Os três tipos de atualização

Existem três itens diferentes que podem ser atualizados, e você pode controlar cada um deles de forma independente:

1. **Software (o sistema principal)** — o próprio NOMAD: a Central de Comando, novos recursos, correções de bugs e melhorias de segurança.
2. **Aplicativos** — os aplicativos instaláveis do [Depósito de Aplicativos](/supply-depot) (Kiwix, o Assistente de IA e quaisquer outros que você tenha adicionado).
3. **Conteúdo** — seu material offline: a Wikipédia e outras bibliotecas do Kiwix, além das regiões de mapas baixadas.

Você pode atualizar qualquer um desses itens manualmente ou configurar atualizações automáticas para cada um deles.

---

## Atualizações manuais

Para verificar e instalar atualizações por conta própria:

1. Acesse **[Configurações → Verificar atualizações](/settings/update)**.
2. Se houver uma atualização de software disponível, clique para instalá-la. O NOMAD fará o download da atualização e será reiniciado (geralmente em 2 a 5 minutos).
3. Os aplicativos podem ser atualizados diretamente em seus cartões no [Depósito de Aplicativos](/supply-depot), usando **Gerenciar › Atualizar**.
4. O conteúdo é gerenciado em **Configurações → Gerenciador de Conteúdo** e **Explorador de Conteúdo**, onde você pode baixar versões mais recentes das bibliotecas e dos mapas instalados.

Se uma atualização de software ou de aplicativo falhar, o NOMAD foi projetado para se recuperar sem grandes problemas: a versão anterior, que estava funcionando, continua em execução, mantendo seu servidor ativo.

---

## Atualizações automáticas

O NOMAD pode se manter atualizado sem que você precise se lembrar de verificar as atualizações. **As atualizações automáticas são opcionais e ficam desativadas por padrão** — nada será atualizado automaticamente até que você ative esse recurso. Você pode gerenciar tudo em **Configurações → Atualizações**.

Algumas regras se aplicam aos três tipos de atualização:

- **Você escolhe um período.** As atualizações automáticas só são executadas durante o horário que você definir, evitando interrupções enquanto você estiver usando o sistema.
- **Versões principais nunca são instaladas automaticamente.** Somente atualizações menores e de correção são aplicadas automaticamente. Uma mudança para uma versão principal mais recente sempre exige que você faça a atualização manualmente, de propósito.
- **As verificações de segurança vêm primeiro.** Antes de aplicar qualquer atualização, o NOMAD confirma se há espaço em disco suficiente e se nenhuma outra atualização, transferência ou instalação já está em andamento.
- **Ficar offline não causa problemas.** Se o NOMAD não conseguir acessar a internet para verificar atualizações, ele simplesmente ignorará aquela tentativa e tentará novamente mais tarde.

### Atualizações automáticas de software (sistema principal)

Ative esse recurso em **Configurações → Atualizações**. Quando habilitado, o NOMAD atualiza seu próprio sistema para versões mais recentes dentro da mesma versão principal, durante o período escolhido e após um intervalo de **espera** configurável (*cool-off*). Esse intervalo permite que uma nova versão seja testada e demonstre sua estabilidade antes de ser instalada no servidor.

A mesma página exibe a opção de ativação, o período de atualização, a configuração do intervalo de espera e o status em tempo real. Se as atualizações falharem repetidamente por um motivo real, o NOMAD desativará o recurso e avisará você, em vez de continuar tentando indefinidamente.

### Atualizações automáticas de aplicativos

As atualizações automáticas de aplicativos são opcionais em **dois níveis**: um interruptor geral em **Configurações → Atualizações** e uma opção individual para cada aplicativo em seu cartão no [Depósito de Aplicativos](/supply-depot). As duas opções precisam estar ativadas para que um aplicativo seja atualizado automaticamente.

As atualizações de aplicativos usam o mesmo período de atualização e o mesmo intervalo de espera do sistema principal. Elas se limitam a versões menores e de correção e interrompem automaticamente as tentativas para qualquer aplicativo que apresente falhas repetidas.

### Atualizações automáticas de conteúdo

As bibliotecas instaladas da Wikipédia e do Kiwix (arquivos ZIM), assim como as regiões de mapas, também podem ser atualizadas automaticamente.

Como os downloads de conteúdo são grandes — muitas vezes ocupando vários gigabytes —, essas atualizações acontecem em um **período noturno exclusivo**, com um **limite de largura de banda**, separado da programação de atualizações do software e dos aplicativos.

O NOMAD consulta diretamente os catálogos de conteúdo do Kiwix e dos mapas. Quando uma biblioteca da Wikipédia é substituída por uma versão mais recente, a Base de Conhecimento da IA também é sincronizada automaticamente.

---

## Canal de Acesso Antecipado

Quer experimentar novos recursos antes que eles cheguem à versão estável? Ative o **Canal de Acesso Antecipado** na página [Verificar atualizações](/settings/update) para receber versões candidatas a lançamento (*release candidates*).

As versões de acesso antecipado podem apresentar alguns problemas ou imperfeições. Você pode voltar à versão estável a qualquer momento.

---

## Antes de ficar offline

Independentemente das opções escolhidas, o hábito mais importante é simples: **atualize enquanto ainda tiver acesso à internet**.

Seja fazendo isso manualmente ou deixando as atualizações automáticas cuidarem do processo, certifique-se de que o software e o conteúdo estejam atualizados antes de ir para um lugar sem conexão. Quando estiver offline, você terá as versões mais recentes que foram sincronizadas, prontas para usar.

**[Verificar atualizações →](/settings/update)** · **[Veja as novidades de cada versão →](/docs/release-notes)**
