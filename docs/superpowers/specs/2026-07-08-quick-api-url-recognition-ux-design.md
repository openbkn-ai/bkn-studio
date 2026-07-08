# Quick API URL Recognition UX Design

## Issue

GitHub issue: #78 `ux(execution-factory): make full API URL recognition discoverable in quick add form`

## Problem

In the Execution Factory quick-add API drawer, the form mode already has a parser that can split a full API URL into server URL, method, path, query parameters, and a fallback tool name. The current trigger is a text-like action placed below the input. In manual testing, users filled the URL but did not notice the action, so the generated fields looked manual and the feature felt missing.

## UX Goal

Make URL recognition happen at the user's point of attention: the full API URL input. A user who pastes a URL should either see the fields populate automatically or have a clear adjacent action to retry recognition.

## Design

### Input Row

Use an input group for the full API URL:

- left side: the full API URL input
- right side: a compact primary-ish `Recognize` button

The button stays visually attached to the URL field, so users see the action while entering the URL.

### Automatic Recognition

When form mode is active, attempt recognition after the URL value changes and the user pauses briefly. This keeps the flow lightweight:

- valid URL: fill server URL, method, path, summary, clear URL field errors, show a lightweight success hint
- invalid partial URL: do nothing while the user is still typing
- explicit button click with invalid URL: show the parse error on the URL field

### Feedback

Use the same calm success style as the execution-factory debug result panels:

- subtle blue-gray background
- soft green status icon
- no large green success block

The message should tell the user what happened, for example: "Recognized server, path and 1 query parameter."

### Scope

In scope:

- Quick add API form mode only
- URL field layout
- automatic URL recognition
- field-level error placement
- preview success color alignment
- component and E2E coverage

Out of scope:

- cURL parser behavior
- backend APIs
- response-example probing
- OpenAPI import flow

## Acceptance

- The recognize action appears on the same row as the full API URL input.
- Pasting `http://host.docker.internal:8080/proxy/uapis/weather?city=北京` fills:
  - server URL: `http://host.docker.internal:8080`
  - method: `GET`
  - path: `/proxy/uapis/weather`
  - fallback tool name: `weather`
  - preview parameter: `city`
- Parse errors appear on the URL field.
- The preview success hint uses the calmer success palette.
- Tests cover the form URL flow and the E2E preview path.
