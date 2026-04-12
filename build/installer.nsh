!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
Var apinaut.InstFinishBitmap
Var apinaut.InstRunCheckbox
Var apinaut.InstRunCheckboxState

!macro customWelcomePage
  ; Welcome page removida por solicitacao.
!macroend

!macro customFinishPage
  PageEx custom
    PageCallbacks apinaut.InstFinishPageCreate apinaut.InstFinishPageLeave
  PageExEnd
!macroend

Function apinaut.InstFinishPageCreate
  InitPluginsDir
  File "/oname=$PLUGINSDIR\apinaut-installer-finish.bmp" "${BUILD_RESOURCES_DIR}\installer-sidebar.bmp"

  nsDialogs::Create 1044
  Pop $0

  ${NSD_CreateBitmap} 0u 0u 109u 193u ""
  Pop $1
  ${NSD_SetStretchedImage} $1 "$PLUGINSDIR\apinaut-installer-finish.bmp" $apinaut.InstFinishBitmap

  ${NSD_CreateLabel} 120u 10u 195u 30u "APInaut instalado com sucesso"
  Pop $2
  SetCtlColors $2 "202020" "transparent"

  ${NSD_CreateLabel} 120u 46u 195u 78u "Tudo pronto. Voce pode abrir o APInaut agora e comecar seus testes de API."
  Pop $3
  SetCtlColors $3 "202020" "transparent"

  ${NSD_CreateCheckBox} 120u 122u 195u 22u "Executar APInaut agora"
  Pop $apinaut.InstRunCheckbox
  SetCtlColors $apinaut.InstRunCheckbox "202020" "transparent"
  ${NSD_Check} $apinaut.InstRunCheckbox

  nsDialogs::Show
  ${NSD_FreeImage} $apinaut.InstFinishBitmap
FunctionEnd

Function apinaut.InstFinishPageLeave
  ${NSD_GetState} $apinaut.InstRunCheckbox $apinaut.InstRunCheckboxState
  ${If} $apinaut.InstRunCheckboxState == ${BST_CHECKED}
    ExecShell "open" "$INSTDIR\APInaut.exe"
  ${EndIf}
FunctionEnd

!endif
!ifdef BUILD_UNINSTALLER
Var apinaut.UnWelcomeBitmap
Var apinaut.UnFinishBitmap
!define MUI_UNTEXT_UNINSTALLING_TITLE "Desinstalando APInaut..."
!define MUI_UNTEXT_UNINSTALLING_SUBTITLE "APInaut esta deixando esta estacao e retornando para a base."

!macro customUnWelcomePage
  UninstPage custom un.ApinautUnWelcomePageCreate un.ApinautUnWelcomePageLeave
!macroend

!macro customUninstallPage
  UninstPage custom un.ApinautUnFinishPageCreate un.ApinautUnFinishPageLeave
  !define MUI_PAGE_CUSTOMFUNCTION_PRE un.ApinautSkipDefaultUnFinishPage
  Function un.ApinautSkipDefaultUnFinishPage
    Abort
  FunctionEnd
!macroend

Function un.ApinautUnWelcomePageCreate
  InitPluginsDir
  File "/oname=$PLUGINSDIR\apinaut-uninstall-welcome.bmp" "${BUILD_RESOURCES_DIR}\uninstaller-welcome.bmp"

  nsDialogs::Create 1044
  Pop $0

  ${NSD_CreateBitmap} 0u 0u 109u 193u ""
  Pop $1
  ${NSD_SetStretchedImage} $1 "$PLUGINSDIR\apinaut-uninstall-welcome.bmp" $apinaut.UnWelcomeBitmap

  ${NSD_CreateLabel} 109u 0u 206u 193u ""
  Pop $4
  SetCtlColors $4 "202020" "FFFFFF"

  ${NSD_CreateLabel} 120u 10u 195u 42u "Deseja realmente desinstalar o APInaut?"
  Pop $2
  SetCtlColors $2 "202020" "FFFFFF"

  ${NSD_CreateLabel} 120u 56u 195u 118u "O explorador espacial das APIs esta prestes a encerrar sua missao neste computador."
  Pop $3
  SetCtlColors $3 "202020" "FFFFFF"

  nsDialogs::Show
  ${NSD_FreeImage} $apinaut.UnWelcomeBitmap
FunctionEnd

Function un.ApinautUnWelcomePageLeave
FunctionEnd

Function un.ApinautUnFinishPageCreate
  InitPluginsDir
  File "/oname=$PLUGINSDIR\apinaut-uninstall-finish.bmp" "${BUILD_RESOURCES_DIR}\uninstaller-finish.bmp"

  nsDialogs::Create 1044
  Pop $0

  ${NSD_CreateBitmap} 0u 0u 109u 193u ""
  Pop $1
  ${NSD_SetStretchedImage} $1 "$PLUGINSDIR\apinaut-uninstall-finish.bmp" $apinaut.UnFinishBitmap

  ${NSD_CreateLabel} 109u 0u 206u 193u ""
  Pop $4
  SetCtlColors $4 "202020" "FFFFFF"

  ${NSD_CreateLabel} 120u 10u 195u 42u "APInaut foi desinstalado com sucesso."
  Pop $2
  SetCtlColors $2 "202020" "FFFFFF"

  ${NSD_CreateLabel} 120u 56u 195u 118u "Obrigado por explorar APIs com a gente.$\r$\nEsperamos te ver novamente em uma proxima missao."
  Pop $3
  SetCtlColors $3 "202020" "FFFFFF"

  nsDialogs::Show
  ${NSD_FreeImage} $apinaut.UnFinishBitmap
FunctionEnd

Function un.ApinautUnFinishPageLeave
FunctionEnd

!endif
