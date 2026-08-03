<script setup lang="ts">
import { useAccountStore } from '~/features/billing/store/useAccountStore'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { accountService } from '~/shared/api/services/accountService'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; updated: [] }>()

const accountStore = useAccountStore()
const authStore = useAuthStore()
const nickname = ref('')
const selectedFile = ref<File | null>(null)
const localAvatarPreview = ref('')
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')
const avatarInputRef = ref<HTMLInputElement | null>(null)

const fallbackAvatar = computed(() => {
  const seed = authStore.session.user?.id || 'livliv-creator'
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`
})
const avatarUrl = computed(() => localAvatarPreview.value || accountStore.profile?.avatarUrl || authStore.session.user?.avatar || fallbackAvatar.value)

function resetForm() {
  nickname.value = accountStore.profile?.nickname || authStore.session.user?.nickname || ''
  selectedFile.value = null
  localAvatarPreview.value = ''
  message.value = ''
  errorMessage.value = ''
}

watch(() => props.open, (open) => {
  if (open) resetForm()
})

function close() {
  if (!saving.value) emit('close')
}

function chooseAvatar() {
  avatarInputRef.value?.click()
}

function handleAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errorMessage.value = '头像仅支持 JPG、PNG 或 WebP 格式。'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = '头像文件不能超过 5MB。'
    return
  }
  if (localAvatarPreview.value.startsWith('blob:')) URL.revokeObjectURL(localAvatarPreview.value)
  selectedFile.value = file
  localAvatarPreview.value = URL.createObjectURL(file)
  errorMessage.value = ''
}

async function saveProfile() {
  const trimmedNickname = nickname.value.trim()
  if (!trimmedNickname) {
    errorMessage.value = '请填写昵称。'
    return
  }
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    // 上传头像和保存昵称均由受登录态保护的后端接口处理，不能直接写对象存储。
    if (selectedFile.value) {
      const uploaded = await accountService.uploadAvatar(selectedFile.value)
      accountStore.profile = uploaded
      authStore.syncUserProfile(uploaded)
    }
    const profile = await accountService.updateProfile({ nickname: trimmedNickname })
    accountStore.profile = profile
    authStore.syncUserProfile(profile)
    message.value = '个人资料已保存。'
    emit('updated')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (localAvatarPreview.value.startsWith('blob:')) URL.revokeObjectURL(localAvatarPreview.value)
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[130] flex items-center justify-center bg-[#0f172a]/45 px-4 backdrop-blur-sm" @click.self="close">
    <section class="w-full max-w-[520px] rounded-[26px] border border-[#dce6f5] bg-white p-7 shadow-[0_26px_90px_rgba(15,23,42,0.24)]">
      <header class="flex items-start justify-between gap-5">
        <div>
          <h2 class="text-[21px] font-black text-[#14213d]">个人资料</h2>
          <p class="mt-1 text-[13px] leading-6 text-[#75839b]">设置创作空间中展示的头像与昵称。</p>
        </div>
        <button type="button" class="rounded-lg p-2 text-[#8b98ad] hover:bg-[#f4f7fb] hover:text-[#34445f]" aria-label="关闭" @click="close">✕</button>
      </header>

      <div class="mt-7 flex items-center gap-5 rounded-2xl bg-[#f7faff] p-5">
        <img :src="avatarUrl" alt="当前头像" class="h-20 w-20 rounded-full border-4 border-white object-cover shadow-sm" />
        <div class="min-w-0">
          <p class="text-[15px] font-black text-[#263651]">创作者头像</p>
          <p class="mt-1 text-[12px] leading-5 text-[#77859d]">注册时已为你生成默认头像；可上传 JPG、PNG、WebP，最大 5MB。</p>
          <button type="button" class="mt-3 rounded-lg border border-[#a8c7ff] bg-white px-3 py-1.5 text-[13px] font-bold text-[#1769ff] hover:bg-[#edf5ff]" @click="chooseAvatar">上传新头像</button>
          <input ref="avatarInputRef" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="handleAvatarChange" />
        </div>
      </div>

      <label class="mt-6 block text-[14px] font-bold text-[#34445f]">
        昵称
        <input v-model="nickname" maxlength="32" class="mt-2 h-11 w-full rounded-xl border border-[#d7e1ef] bg-white px-3 text-[14px] text-[#1f2d45] outline-none transition focus:border-[#2f76ff] focus:ring-4 focus:ring-[#2f76ff]/10" placeholder="请输入昵称" />
        <span class="mt-2 block text-[12px] font-medium text-[#8a98ad]">最多 32 个字符，显示于项目与账户菜单中。</span>
      </label>

      <p v-if="message" class="mt-5 rounded-xl bg-[#ecfdf3] px-3 py-2 text-[13px] font-semibold text-[#138a53]">{{ message }}</p>
      <p v-if="errorMessage" class="mt-5 rounded-xl bg-[#fff1f1] px-3 py-2 text-[13px] font-semibold text-[#df3d45]">{{ errorMessage }}</p>

      <footer class="mt-7 flex justify-end gap-3">
        <button type="button" class="h-10 rounded-xl border border-[#d8e1ef] px-5 text-[14px] font-bold text-[#63718a] hover:bg-[#f8fafc]" :disabled="saving" @click="close">取消</button>
        <button type="button" class="h-10 rounded-xl bg-[#1769ff] px-5 text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(23,105,255,0.25)] hover:bg-[#0c5de9] disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving" @click="saveProfile">{{ saving ? '保存中...' : '保存资料' }}</button>
      </footer>
    </section>
  </div>
</template>
