<script setup lang="ts">
import LegalReadingPage from '~/components/legal/LegalReadingPage.vue'
const route=useRoute()
</script>
<template><LegalReadingPage :code="String(route.params.code)"/></template>
