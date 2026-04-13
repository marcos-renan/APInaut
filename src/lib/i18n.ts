export type AppLocale = "pt-BR" | "en-US" | "es-ES";

export const APP_LOCALE_STORAGE_KEY = "apinaut:locale:v1";
export const DEFAULT_APP_LOCALE: AppLocale = "pt-BR";

export type TranslationKey =
  | "common.select"
  | "common.close"
  | "common.cancel"
  | "common.create"
  | "common.delete"
  | "common.rename"
  | "common.action"
  | "common.active"
  | "common.value"
  | "common.key"
  | "common.type"
  | "common.file"
  | "common.text"
  | "common.code"
  | "common.web"
  | "language.select"
  | "language.portuguese"
  | "language.english"
  | "language.spanish"
  | "titlebar.minimize"
  | "titlebar.maximize"
  | "titlebar.restore"
  | "titlebar.close"
  | "home.title"
  | "home.import"
  | "home.createCollection"
  | "home.none"
  | "home.options"
  | "home.clickToOpen"
  | "home.createdOn"
  | "home.environments"
  | "home.folders"
  | "home.requests"
  | "home.exportJson"
  | "home.exportYaml"
  | "home.deleteCollection"
  | "home.importModal.title"
  | "home.importModal.description"
  | "home.importModal.dropTitle"
  | "home.importModal.dropDescription"
  | "home.newCollection.title"
  | "home.newCollection.description"
  | "home.newCollection.placeholder"
  | "home.deleteModal.title"
  | "home.deleteModal.confirm"
  | "home.deleteModal.warning"
  | "home.feedback.exportSuccessSingle"
  | "home.feedback.exportSuccessAll"
  | "home.feedback.exportError"
  | "home.feedback.deleteSuccess"
  | "home.feedback.importUnsupported"
  | "home.feedback.importNone"
  | "home.feedback.importSuccess"
  | "home.feedback.importIgnored"
  | "home.feedback.importFailed"
  | "collection.loading"
  | "collection.notFound.title"
  | "collection.notFound.description"
  | "collection.back"
  | "collection.noEnvironment"
  | "collection.noGlobal"
  | "collection.localPrefix"
  | "collection.globalPrefix"
  | "collection.environments"
  | "collection.resizeRequests"
  | "collection.resizeResponse"
  | "collection.urlPreviewMissing"
  | "collection.urlPreviewInvalid"
  | "collection.fileLoadError"
  | "collection.multipartMissingFile"
  | "collection.scriptInvalidJson"
  | "collection.scriptResponseUnavailable"
  | "collection.preRequestScriptError"
  | "collection.afterResponseScriptError"
  | "collection.sendUnexpectedError"
  | "requestTree.title"
  | "requestTree.createFolder"
  | "requestTree.createRequest"
  | "requestTree.none"
  | "requestTree.folderNamePlaceholder"
  | "requestTree.requestNamePlaceholder"
  | "requestMenu.newRequestHere"
  | "requestMenu.newFolderHere"
  | "editor.send"
  | "editor.sending"
  | "editor.sendRequest"
  | "editor.sendingRequest"
  | "editor.tab.params"
  | "editor.tab.body"
  | "editor.tab.auth"
  | "editor.tab.headers"
  | "editor.tab.script"
  | "editor.urlPreview"
  | "editor.copyUrlPreview"
  | "editor.body.none"
  | "editor.body.json"
  | "editor.body.text"
  | "editor.body.multipart"
  | "editor.body.nonePlaceholder"
  | "editor.body.textPlaceholder"
  | "editor.auth.none"
  | "editor.auth.bearer"
  | "editor.auth.basic"
  | "editor.auth.hideToken"
  | "editor.auth.showToken"
  | "editor.auth.hidePassword"
  | "editor.auth.showPassword"
  | "editor.script.preRequest"
  | "editor.script.afterResponse"
  | "editor.script.shortcuts"
  | "editor.script.shortcutResponseJson"
  | "editor.script.shortcutEnvSet"
  | "editor.script.shortcutGlobalSet"
  | "editor.script.shortcutCompat"
  | "editor.empty"
  | "response.status"
  | "response.time"
  | "response.transferred"
  | "response.body"
  | "response.headers"
  | "response.cookies"
  | "response.previewUnavailable"
  | "response.none"
  | "response.noneCookies"
  | "response.noneHeaders"
  | "response.previewTitle"
  | "state.requestError"
  | "state.scriptError"
  | "state.error"
  | "state.ok"
  | "templateSuggestion.environmentVariables"
  | "env.manage"
  | "env.locals"
  | "env.globals"
  | "env.localPlaceholder"
  | "env.globalPlaceholder"
  | "env.createLocal"
  | "env.createGlobal"
  | "env.noneLocal"
  | "env.noneGlobal"
  | "env.activeTag"
  | "env.deleteEnvironment"
  | "env.deleteEnvironmentConfirm"
  | "env.deleteVariable"
  | "env.deleteVariableConfirm"
  | "env.dragVariable"
  | "env.activate"
  | "env.localActive"
  | "env.globalActive"
  | "env.columnMove"
  | "env.columnActive"
  | "env.columnVariable"
  | "env.columnValue"
  | "env.columnAction"
  | "env.addVariable"
  | "env.emptyEditLocal"
  | "env.emptyEditGlobal"
  | "table.toggleOff"
  | "table.toggleOn"
  | "table.removeRow"
  | "table.removeRowConfirm"
  | "table.addRow"
  | "table.addField"
  | "table.selectFile";

const translationsBase: Record<"pt-BR" | "en-US", Record<TranslationKey, string>> = {
  "pt-BR": {
    "common.select": "Selecionar",
    "common.close": "Fechar",
    "common.cancel": "Cancelar",
    "common.create": "Criar",
    "common.delete": "Deletar",
    "common.rename": "Renomear",
    "common.action": "Ação",
    "common.active": "Ativo",
    "common.value": "Valor",
    "common.key": "Chave",
    "common.type": "Tipo",
    "common.file": "Arquivo",
    "common.text": "Text",
    "common.code": "Código",
    "common.web": "Web",
    "language.select": "Idioma",
    "language.portuguese": "Português (Brasil)",
    "language.english": "Inglês (Estados Unidos)",
    "language.spanish": "Espanhol (Espanha)",
    "titlebar.minimize": "Minimizar",
    "titlebar.maximize": "Maximizar",
    "titlebar.restore": "Restaurar",
    "titlebar.close": "Fechar",
    "home.title": "Coleções",
    "home.import": "Importar",
    "home.createCollection": "Criar coleção",
    "home.none": "Nenhuma coleção criada ainda.",
    "home.options": "Opções",
    "home.clickToOpen": "Clique para abrir",
    "home.createdOn": "Criada em {date}",
    "home.environments": "{count} ambiente(s)",
    "home.folders": "{count} pasta(s)",
    "home.requests": "{count} request(s)",
    "home.exportJson": "Exportar JSON",
    "home.exportYaml": "Exportar YAML",
    "home.deleteCollection": "Deletar coleção",
    "home.importModal.title": "Importar Coleções",
    "home.importModal.description": "Selecione arquivos manualmente. Formatos aceitos: JSON e YAML.",
    "home.importModal.dropTitle": "Clique para escolher os arquivos",
    "home.importModal.dropDescription": "Você pode selecionar múltiplos arquivos de uma vez.",
    "home.newCollection.title": "Nova coleção",
    "home.newCollection.description": "Insira o nome da coleção.",
    "home.newCollection.placeholder": "Ex: API de pagamentos",
    "home.deleteModal.title": "Deletar coleção",
    "home.deleteModal.confirm": "Tem certeza que deseja deletar \"{name}\"?",
    "home.deleteModal.warning": "Essa ação não pode ser desfeita.",
    "home.feedback.exportSuccessSingle": "Exportação em {format} da coleção \"{name}\" concluída.",
    "home.feedback.exportSuccessAll": "Exportação em {format} das coleções concluída.",
    "home.feedback.exportError": "Não foi possível exportar as coleções.",
    "home.feedback.deleteSuccess": "Coleção \"{name}\" deletada com sucesso.",
    "home.feedback.importUnsupported": "Selecione arquivos .json, .yaml ou .yml para importar.",
    "home.feedback.importNone": "Nenhuma coleção válida encontrada nos arquivos selecionados.",
    "home.feedback.importSuccess": "{count} coleção(ões) importada(s) com sucesso.",
    "home.feedback.importIgnored": " {count} arquivo(s) incompatível(is) foram ignorados.",
    "home.feedback.importFailed": "Falha ao importar arquivo.",
    "collection.loading": "Carregando coleção...",
    "collection.notFound.title": "Coleção não encontrada",
    "collection.notFound.description": "Essa coleção não existe mais ou foi removida do armazenamento local.",
    "collection.back": "Voltar para coleções",
    "collection.noEnvironment": "Sem ambiente",
    "collection.noGlobal": "Sem global",
    "collection.localPrefix": "Local: {name}",
    "collection.globalPrefix": "Global: {name}",
    "collection.environments": "Ambientes",
    "collection.resizeRequests": "Redimensionar painel de requisições",
    "collection.resizeResponse": "Redimensionar painel de resposta",
    "collection.urlPreviewMissing": "Informe uma URL para visualizar o preview.",
    "collection.urlPreviewInvalid": "URL inválida para preview. Verifique URL e variáveis do ambiente.",
    "collection.fileLoadError": "Falha ao carregar o arquivo selecionado.",
    "collection.multipartMissingFile": "Selecione um arquivo para o campo multipart \"{field}\" antes de enviar.",
    "collection.scriptInvalidJson": "A resposta não é um JSON válido.",
    "collection.scriptResponseUnavailable": "Resposta indisponivel no pre-request.",
    "collection.preRequestScriptError": "Falha no script pre-request.",
    "collection.afterResponseScriptError": "Falha no script after-response.",
    "collection.sendUnexpectedError": "Erro inesperado ao enviar requisição.",
    "requestTree.title": "Requisições",
    "requestTree.createFolder": "Criar nova pasta",
    "requestTree.createRequest": "Criar nova requisição",
    "requestTree.none": "Nenhuma requisição ainda.",
    "requestTree.folderNamePlaceholder": "Nome da pasta",
    "requestTree.requestNamePlaceholder": "Nome da requisição",
    "requestMenu.newRequestHere": "Nova request aqui",
    "requestMenu.newFolderHere": "Nova pasta aqui",
    "editor.send": "Enviar",
    "editor.sending": "Enviando...",
    "editor.sendRequest": "Enviar requisição",
    "editor.sendingRequest": "Enviando requisição",
    "editor.tab.params": "Params",
    "editor.tab.body": "Body",
    "editor.tab.auth": "Auth",
    "editor.tab.headers": "Headers",
    "editor.tab.script": "Script",
    "editor.urlPreview": "URL Preview",
    "editor.copyUrlPreview": "Copiar URL preview",
    "editor.body.none": "Sem body",
    "editor.body.json": "JSON",
    "editor.body.text": "Text",
    "editor.body.multipart": "Multipart Form",
    "editor.body.nonePlaceholder": "Selecione JSON, Text ou Multipart para habilitar o body.",
    "editor.body.textPlaceholder": "Digite o body da requisição.",
    "editor.auth.none": "Nenhuma",
    "editor.auth.bearer": "Bearer Token",
    "editor.auth.basic": "Basic Auth",
    "editor.auth.hideToken": "Ocultar token",
    "editor.auth.showToken": "Mostrar token",
    "editor.auth.hidePassword": "Ocultar senha",
    "editor.auth.showPassword": "Mostrar senha",
    "editor.script.preRequest": "Pre-request",
    "editor.script.afterResponse": "After-response",
    "editor.script.shortcuts": "Atalhos de script:",
    "editor.script.shortcutResponseJson": "`apinaut.response.json()` para ler JSON da resposta.",
    "editor.script.shortcutEnvSet": "`apinaut.environment.set(\"token\", \"...\")` para salvar variável no ambiente ativo.",
    "editor.script.shortcutGlobalSet": "`apinaut.global.set(\"url_base\", \"http://localhost:8080/\")` para salvar no ambiente global ativo.",
    "editor.script.shortcutCompat": "Também funciona com compatibilidade: `insomnia.collectionVariables.set(...)`.",
    "editor.empty": "Crie ou selecione uma requisição para começar.",
    "response.status": "Status",
    "response.time": "Tempo",
    "response.transferred": "Transferido",
    "response.body": "Body",
    "response.headers": "Headers",
    "response.cookies": "Cookies",
    "response.previewUnavailable": "Não foi possível renderizar a página por erro na requisição.",
    "response.none": "Nenhuma resposta ainda.",
    "response.noneCookies": "Nenhum cookie retornado.",
    "response.noneHeaders": "Nenhum header retornado.",
    "response.previewTitle": "Preview da resposta",
    "state.requestError": "Erro de requisição",
    "state.scriptError": "Erro de script",
    "state.error": "Erro",
    "state.ok": "OK",
    "templateSuggestion.environmentVariables": "Variáveis de ambiente",
    "env.manage": "Gerenciar ambientes",
    "env.locals": "Locais",
    "env.globals": "Globais",
    "env.localPlaceholder": "Nome do ambiente local",
    "env.globalPlaceholder": "Nome do ambiente global",
    "env.createLocal": "Criar ambiente local",
    "env.createGlobal": "Criar ambiente global",
    "env.noneLocal": "Nenhum ambiente local criado.",
    "env.noneGlobal": "Nenhum ambiente global criado.",
    "env.activeTag": "ativo",
    "env.deleteEnvironment": "Deletar ambiente",
    "env.deleteEnvironmentConfirm": "Clique novamente para deletar ambiente",
    "env.deleteVariable": "Remover variável",
    "env.deleteVariableConfirm": "Clique novamente para remover variável",
    "env.dragVariable": "Arrastar variável",
    "env.activate": "Ativar",
    "env.localActive": "Ambiente local ativo",
    "env.globalActive": "Ambiente global ativo",
    "env.columnMove": "Mover",
    "env.columnActive": "Ativo",
    "env.columnVariable": "Variável",
    "env.columnValue": "Valor",
    "env.columnAction": "Ação",
    "env.addVariable": "+ Adicionar variável",
    "env.emptyEditLocal": "Crie ou selecione um ambiente local para editar.",
    "env.emptyEditGlobal": "Crie ou selecione um ambiente global para editar.",
    "table.toggleOff": "Desativar linha",
    "table.toggleOn": "Ativar linha",
    "table.removeRow": "Remover linha",
    "table.removeRowConfirm": "Clique novamente para remover linha",
    "table.addRow": "+ Adicionar linha",
    "table.addField": "+ Adicionar campo",
    "table.selectFile": "Selecionar arquivo"
  },
  "en-US": {
    "common.select": "Select",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.create": "Create",
    "common.delete": "Delete",
    "common.rename": "Rename",
    "common.action": "Action",
    "common.active": "Active",
    "common.value": "Value",
    "common.key": "Key",
    "common.type": "Type",
    "common.file": "File",
    "common.text": "Text",
    "common.code": "Code",
    "common.web": "Web",
    "language.select": "Language",
    "language.portuguese": "Portuguese (Brazil)",
    "language.english": "English (USA)",
    "language.spanish": "Spanish (Spain)",
    "titlebar.minimize": "Minimize",
    "titlebar.maximize": "Maximize",
    "titlebar.restore": "Restore",
    "titlebar.close": "Close",
    "home.title": "Collections",
    "home.import": "Import",
    "home.createCollection": "Create collection",
    "home.none": "No collections yet.",
    "home.options": "Options",
    "home.clickToOpen": "Click to open",
    "home.createdOn": "Created on {date}",
    "home.environments": "{count} environment(s)",
    "home.folders": "{count} folder(s)",
    "home.requests": "{count} request(s)",
    "home.exportJson": "Export JSON",
    "home.exportYaml": "Export YAML",
    "home.deleteCollection": "Delete collection",
    "home.importModal.title": "Import Collections",
    "home.importModal.description": "Select files manually. Accepted formats: JSON and YAML.",
    "home.importModal.dropTitle": "Click to choose files",
    "home.importModal.dropDescription": "You can select multiple files at once.",
    "home.newCollection.title": "New collection",
    "home.newCollection.description": "Enter the collection name.",
    "home.newCollection.placeholder": "Ex: Payments API",
    "home.deleteModal.title": "Delete collection",
    "home.deleteModal.confirm": "Are you sure you want to delete \"{name}\"?",
    "home.deleteModal.warning": "This action cannot be undone.",
    "home.feedback.exportSuccessSingle": "{format} export for collection \"{name}\" completed.",
    "home.feedback.exportSuccessAll": "{format} export for collections completed.",
    "home.feedback.exportError": "Could not export collections.",
    "home.feedback.deleteSuccess": "Collection \"{name}\" deleted successfully.",
    "home.feedback.importUnsupported": "Select .json, .yaml or .yml files to import.",
    "home.feedback.importNone": "No valid collections were found in selected files.",
    "home.feedback.importSuccess": "{count} collection(s) imported successfully.",
    "home.feedback.importIgnored": " {count} incompatible file(s) were ignored.",
    "home.feedback.importFailed": "Failed to import file.",
    "collection.loading": "Loading collection...",
    "collection.notFound.title": "Collection not found",
    "collection.notFound.description": "This collection no longer exists or was removed from local storage.",
    "collection.back": "Back to collections",
    "collection.noEnvironment": "No environment",
    "collection.noGlobal": "No global",
    "collection.localPrefix": "Local: {name}",
    "collection.globalPrefix": "Global: {name}",
    "collection.environments": "Environments",
    "collection.resizeRequests": "Resize requests panel",
    "collection.resizeResponse": "Resize response panel",
    "collection.urlPreviewMissing": "Provide a URL to preview.",
    "collection.urlPreviewInvalid": "Invalid URL for preview. Check URL and environment variables.",
    "collection.fileLoadError": "Failed to load selected file.",
    "collection.multipartMissingFile": "Select a file for multipart field \"{field}\" before sending.",
    "collection.scriptInvalidJson": "Response is not valid JSON.",
    "collection.scriptResponseUnavailable": "Response unavailable in pre-request.",
    "collection.preRequestScriptError": "Pre-request script failed.",
    "collection.afterResponseScriptError": "After-response script failed.",
    "collection.sendUnexpectedError": "Unexpected error while sending request.",
    "requestTree.title": "Requests",
    "requestTree.createFolder": "Create new folder",
    "requestTree.createRequest": "Create new request",
    "requestTree.none": "No requests yet.",
    "requestTree.folderNamePlaceholder": "Folder name",
    "requestTree.requestNamePlaceholder": "Request name",
    "requestMenu.newRequestHere": "New request here",
    "requestMenu.newFolderHere": "New folder here",
    "editor.send": "Send",
    "editor.sending": "Sending...",
    "editor.sendRequest": "Send request",
    "editor.sendingRequest": "Sending request",
    "editor.tab.params": "Params",
    "editor.tab.body": "Body",
    "editor.tab.auth": "Auth",
    "editor.tab.headers": "Headers",
    "editor.tab.script": "Script",
    "editor.urlPreview": "URL Preview",
    "editor.copyUrlPreview": "Copy URL preview",
    "editor.body.none": "No body",
    "editor.body.json": "JSON",
    "editor.body.text": "Text",
    "editor.body.multipart": "Multipart Form",
    "editor.body.nonePlaceholder": "Select JSON, Text or Multipart to enable body.",
    "editor.body.textPlaceholder": "Type the request body.",
    "editor.auth.none": "None",
    "editor.auth.bearer": "Bearer Token",
    "editor.auth.basic": "Basic Auth",
    "editor.auth.hideToken": "Hide token",
    "editor.auth.showToken": "Show token",
    "editor.auth.hidePassword": "Hide password",
    "editor.auth.showPassword": "Show password",
    "editor.script.preRequest": "Pre-request",
    "editor.script.afterResponse": "After-response",
    "editor.script.shortcuts": "Script shortcuts:",
    "editor.script.shortcutResponseJson": "`apinaut.response.json()` to read response JSON.",
    "editor.script.shortcutEnvSet": "`apinaut.environment.set(\"token\", \"...\")` to save variable in active environment.",
    "editor.script.shortcutGlobalSet": "`apinaut.global.set(\"url_base\", \"http://localhost:8080/\")` to save in active global environment.",
    "editor.script.shortcutCompat": "Compatibility also works: `insomnia.collectionVariables.set(...)`.",
    "editor.empty": "Create or select a request to start.",
    "response.status": "Status",
    "response.time": "Time",
    "response.transferred": "Transferred",
    "response.body": "Body",
    "response.headers": "Headers",
    "response.cookies": "Cookies",
    "response.previewUnavailable": "Could not render page because request failed.",
    "response.none": "No response yet.",
    "response.noneCookies": "No cookies returned.",
    "response.noneHeaders": "No headers returned.",
    "response.previewTitle": "Response preview",
    "state.requestError": "Request Error",
    "state.scriptError": "Script Error",
    "state.error": "Error",
    "state.ok": "OK",
    "templateSuggestion.environmentVariables": "Environment variables",
    "env.manage": "Manage environments",
    "env.locals": "Locals",
    "env.globals": "Globals",
    "env.localPlaceholder": "Local environment name",
    "env.globalPlaceholder": "Global environment name",
    "env.createLocal": "Create local environment",
    "env.createGlobal": "Create global environment",
    "env.noneLocal": "No local environment created.",
    "env.noneGlobal": "No global environment created.",
    "env.activeTag": "active",
    "env.deleteEnvironment": "Delete environment",
    "env.deleteEnvironmentConfirm": "Click again to delete environment",
    "env.deleteVariable": "Remove variable",
    "env.deleteVariableConfirm": "Click again to remove variable",
    "env.dragVariable": "Drag variable",
    "env.activate": "Activate",
    "env.localActive": "Local environment active",
    "env.globalActive": "Global environment active",
    "env.columnMove": "Move",
    "env.columnActive": "Active",
    "env.columnVariable": "Variable",
    "env.columnValue": "Value",
    "env.columnAction": "Action",
    "env.addVariable": "+ Add variable",
    "env.emptyEditLocal": "Create or select a local environment to edit.",
    "env.emptyEditGlobal": "Create or select a global environment to edit.",
    "table.toggleOff": "Disable row",
    "table.toggleOn": "Enable row",
    "table.removeRow": "Remove row",
    "table.removeRowConfirm": "Click again to remove row",
    "table.addRow": "+ Add row",
    "table.addField": "+ Add field",
    "table.selectFile": "Select file"
  },
};

const spanishOverrides: Partial<Record<TranslationKey, string>> = {
  "common.select": "Seleccionar",
  "common.close": "Cerrar",
  "common.cancel": "Cancelar",
  "common.create": "Crear",
  "common.delete": "Eliminar",
  "common.rename": "Renombrar",
  "common.action": "Acción",
  "common.active": "Activo",
  "common.value": "Valor",
  "common.key": "Clave",
  "common.type": "Tipo",
  "common.file": "Archivo",
  "common.code": "Código",
  "language.select": "Idioma",
  "language.portuguese": "Portugués (Brasil)",
  "language.english": "Inglés (Estados Unidos)",
  "language.spanish": "Español (España)",
  "titlebar.minimize": "Minimizar",
  "titlebar.maximize": "Maximizar",
  "titlebar.restore": "Restaurar",
  "titlebar.close": "Cerrar",
  "home.title": "Colecciones",
  "home.import": "Importar",
  "home.createCollection": "Crear colección",
  "home.none": "Todavía no hay colecciones.",
  "home.options": "Opciones",
  "home.clickToOpen": "Haz clic para abrir",
  "home.createdOn": "Creada el {date}",
  "home.environments": "{count} entorno(s)",
  "home.folders": "{count} carpeta(s)",
  "home.requests": "{count} request(s)",
  "home.exportJson": "Exportar JSON",
  "home.exportYaml": "Exportar YAML",
  "home.deleteCollection": "Eliminar colección",
  "home.importModal.title": "Importar Colecciones",
  "home.importModal.description": "Selecciona archivos manualmente. Formatos aceptados: JSON y YAML.",
  "home.importModal.dropTitle": "Haz clic para elegir archivos",
  "home.importModal.dropDescription": "Puedes seleccionar varios archivos a la vez.",
  "home.newCollection.title": "Nueva colección",
  "home.newCollection.description": "Ingresa el nombre de la colección.",
  "home.newCollection.placeholder": "Ej: API de pagos",
  "home.deleteModal.title": "Eliminar colección",
  "home.deleteModal.confirm": "¿Seguro que deseas eliminar \"{name}\"?",
  "home.deleteModal.warning": "Esta acción no se puede deshacer.",
  "home.feedback.exportSuccessSingle": "Exportación en {format} de la colección \"{name}\" completada.",
  "home.feedback.exportSuccessAll": "Exportación en {format} de las colecciones completada.",
  "home.feedback.exportError": "No se pudieron exportar las colecciones.",
  "home.feedback.deleteSuccess": "Colección \"{name}\" eliminada con éxito.",
  "home.feedback.importUnsupported": "Selecciona archivos .json, .yaml o .yml para importar.",
  "home.feedback.importNone": "No se encontró ninguna colección válida en los archivos seleccionados.",
  "home.feedback.importSuccess": "{count} colección(es) importada(s) con éxito.",
  "home.feedback.importIgnored": " Se ignoraron {count} archivo(s) incompatible(s).",
  "home.feedback.importFailed": "Error al importar el archivo.",
  "collection.loading": "Cargando colección...",
  "collection.notFound.title": "Colección no encontrada",
  "collection.notFound.description": "Esta colección ya no existe o fue eliminada del almacenamiento local.",
  "collection.back": "Volver a colecciones",
  "collection.noEnvironment": "Sin entorno",
  "collection.noGlobal": "Sin global",
  "collection.localPrefix": "Local: {name}",
  "collection.globalPrefix": "Global: {name}",
  "collection.environments": "Entornos",
  "collection.resizeRequests": "Redimensionar panel de requests",
  "collection.resizeResponse": "Redimensionar panel de respuesta",
  "collection.urlPreviewMissing": "Ingresa una URL para ver la vista previa.",
  "collection.urlPreviewInvalid": "URL inválida para vista previa. Revisa la URL y las variables del entorno.",
  "collection.fileLoadError": "No se pudo cargar el archivo seleccionado.",
  "collection.multipartMissingFile": "Selecciona un archivo para el campo multipart \"{field}\" antes de enviar.",
  "collection.scriptInvalidJson": "La respuesta no es un JSON válido.",
  "collection.scriptResponseUnavailable": "Respuesta no disponible en pre-request.",
  "collection.preRequestScriptError": "Error en el script pre-request.",
  "collection.afterResponseScriptError": "Error en el script after-response.",
  "collection.sendUnexpectedError": "Error inesperado al enviar la request.",
  "requestTree.title": "Requests",
  "requestTree.createFolder": "Crear nueva carpeta",
  "requestTree.createRequest": "Crear nueva request",
  "requestTree.none": "Aún no hay requests.",
  "requestTree.folderNamePlaceholder": "Nombre de la carpeta",
  "requestTree.requestNamePlaceholder": "Nombre de la request",
  "requestMenu.newRequestHere": "Nueva request aquí",
  "requestMenu.newFolderHere": "Nueva carpeta aquí",
  "editor.send": "Enviar",
  "editor.sending": "Enviando...",
  "editor.sendRequest": "Enviar request",
  "editor.sendingRequest": "Enviando request",
  "editor.tab.headers": "Headers",
  "editor.urlPreview": "Vista previa de URL",
  "editor.copyUrlPreview": "Copiar vista previa de URL",
  "editor.body.none": "Sin body",
  "editor.body.nonePlaceholder": "Selecciona JSON, Text o Multipart para habilitar el body.",
  "editor.body.textPlaceholder": "Escribe el body de la request.",
  "editor.auth.none": "Ninguna",
  "editor.auth.hideToken": "Ocultar token",
  "editor.auth.showToken": "Mostrar token",
  "editor.auth.hidePassword": "Ocultar contraseña",
  "editor.auth.showPassword": "Mostrar contraseña",
  "editor.script.shortcuts": "Atajos de script:",
  "editor.script.shortcutResponseJson": "`apinaut.response.json()` para leer el JSON de la respuesta.",
  "editor.script.shortcutEnvSet":
    "`apinaut.environment.set(\"token\", \"...\")` para guardar una variable en el entorno activo.",
  "editor.script.shortcutGlobalSet":
    "`apinaut.global.set(\"url_base\", \"http://localhost:8080/\")` para guardar en el entorno global activo.",
  "editor.script.shortcutCompat": "También funciona en modo compatibilidad: `insomnia.collectionVariables.set(...)`.",
  "editor.empty": "Crea o selecciona una request para empezar.",
  "response.time": "Tiempo",
  "response.transferred": "Transferido",
  "response.previewUnavailable": "No se pudo renderizar la página por un error en la request.",
  "response.none": "Sin respuesta todavía.",
  "response.noneCookies": "No se devolvieron cookies.",
  "response.noneHeaders": "No se devolvieron headers.",
  "response.previewTitle": "Vista previa de la respuesta",
  "state.requestError": "Error de request",
  "state.scriptError": "Error de script",
  "state.error": "Error",
  "templateSuggestion.environmentVariables": "Variables de entorno",
  "env.manage": "Gestionar entornos",
  "env.locals": "Locales",
  "env.globals": "Globales",
  "env.localPlaceholder": "Nombre del entorno local",
  "env.globalPlaceholder": "Nombre del entorno global",
  "env.createLocal": "Crear entorno local",
  "env.createGlobal": "Crear entorno global",
  "env.noneLocal": "No hay entornos locales creados.",
  "env.noneGlobal": "No hay entornos globales creados.",
  "env.deleteEnvironment": "Eliminar entorno",
  "env.deleteEnvironmentConfirm": "Haz clic de nuevo para eliminar el entorno",
  "env.deleteVariable": "Eliminar variable",
  "env.deleteVariableConfirm": "Haz clic de nuevo para eliminar la variable",
  "env.dragVariable": "Arrastrar variable",
  "env.activate": "Activar",
  "env.localActive": "Entorno local activo",
  "env.globalActive": "Entorno global activo",
  "env.columnMove": "Mover",
  "env.columnVariable": "Variable",
  "env.columnAction": "Acción",
  "env.addVariable": "+ Agregar variable",
  "env.emptyEditLocal": "Crea o selecciona un entorno local para editar.",
  "env.emptyEditGlobal": "Crea o selecciona un entorno global para editar.",
  "table.toggleOff": "Desactivar línea",
  "table.toggleOn": "Activar línea",
  "table.removeRow": "Eliminar línea",
  "table.removeRowConfirm": "Haz clic de nuevo para eliminar la línea",
  "table.addRow": "+ Agregar línea",
  "table.addField": "+ Agregar campo",
  "table.selectFile": "Seleccionar archivo",
};

const translations: Record<AppLocale, Partial<Record<TranslationKey, string>>> = {
  ...translationsBase,
  "es-ES": {
    ...translationsBase["en-US"],
    ...spanishOverrides,
  },
};

export const isAppLocale = (value: string): value is AppLocale =>
  value === "pt-BR" || value === "en-US" || value === "es-ES";

export const formatDateByLocale = (value: string | number | Date, locale: AppLocale) =>
  new Intl.DateTimeFormat(locale).format(new Date(value));

export const translate = (
  locale: AppLocale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string => {
  const table = translations[locale] ?? translations[DEFAULT_APP_LOCALE];
  const fallbackTable = translations["en-US"];
  const defaultTable = translations[DEFAULT_APP_LOCALE];
  const template = table[key] ?? fallbackTable[key] ?? defaultTable[key] ?? key;

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(params[token] ?? ""));
};

