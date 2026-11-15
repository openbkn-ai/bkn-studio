{{/*
The SPA's runtime config, window.__BKN_STUDIO_RUNTIME__, as JSON: the `runtime` value, plus
mode "hosted" when auth is off (that is what turns the in-SPA OAuth gate off). With auth on, any
`runtime.mode` is dropped, so only `auth.enabled` decides whether the gate is on. Empty ("{}")
when there is nothing to set: the image's own no-op config.js is then left in place.
*/}}
{{- define "bkn-studio.runtime" -}}
{{- $runtime := deepCopy (.Values.runtime | default dict) -}}
{{- if not .Values.auth.enabled -}}
{{- $_ := set $runtime "mode" "hosted" -}}
{{- else -}}
{{- $_ := unset $runtime "mode" -}}
{{- end -}}
{{- toJson $runtime -}}
{{- end -}}
