import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import PasswordConfirmModal from './PasswordConfirmModal'
import { formatDate } from '../lib/format'
import { apiClient } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export interface UserSession {
  id: string
  user_id: string
  device_info: string
  ip_address: string
  created_at: string
  last_seen_at: string
  is_current: boolean
}

interface ActiveSessionsModalProps {
  open: boolean
  onClose: () => void
  sessions: UserSession[]
  loading: boolean
  onRefreshSessions: () => Promise<void>
}

export function ActiveSessionsModal({
  open,
  onClose,
  sessions,
  loading,
  onRefreshSessions,
}: ActiveSessionsModalProps) {
  const { logout } = useAuth()
  const [revokeModalOpen, setRevokeModalOpen] = useState(false)
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null)
  const [isRevokeAll, setIsRevokeAll] = useState(false)

  const handleConfirmRevoke = async (password: string) => {
    if (isRevokeAll) {
      await apiClient.post('/user/sessions/revoke-all', { password })
      await onRefreshSessions()
    } else if (targetSessionId) {
      const res = await apiClient.post<{ is_current_revoked: boolean }>('/user/sessions/revoke', {
        session_id: targetSessionId,
        password,
      })
      if (res.data.is_current_revoked) {
        logout()
      } else {
        await onRefreshSessions()
      }
    }
  }

  if (!open) return null

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length

  return (
    <>
      <Modal open={open} onClose={onClose} label="Active Device Sessions" maxWidthClass="max-w-xl">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Active Device Sessions</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage logged-in browsers and devices connected to your account.
              </p>
            </div>
            {otherSessionsCount > 0 && (
              <Button
                variant="secondary"
                className="py-1 px-3 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                onClick={() => {
                  setIsRevokeAll(true)
                  setTargetSessionId(null)
                  setRevokeModalOpen(true)
                }}
              >
                Sign Out All Other Devices
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/60">
              <Spinner size={24} />
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 text-center">
              No active sessions recorded.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/60 divide-y divide-slate-200/60 dark:divide-zinc-800/60">
              {sessions.map((sess) => (
                <div key={sess.id} className="flex items-center justify-between pt-3 first:pt-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700 text-base font-bold dark:bg-zinc-800 dark:text-zinc-300">
                      {sess.device_info.includes('Windows') || sess.device_info.includes('macOS') ? '💻' : '📱'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-zinc-200">
                          {sess.device_info}
                        </p>
                        {sess.is_current && (
                          <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                            Current Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Logged in {formatDate(sess.created_at)} • <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">{sess.ip_address}</span>
                    {!sess.is_current && (
                      <Button
                        variant="secondary"
                        className="py-1 px-2.5 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        onClick={() => {
                          setIsRevokeAll(false)
                          setTargetSessionId(sess.id)
                          setRevokeModalOpen(true)
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-zinc-800">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <PasswordConfirmModal
        isOpen={revokeModalOpen}
        onClose={() => {
          setRevokeModalOpen(false)
          setTargetSessionId(null)
          setIsRevokeAll(false)
        }}
        onConfirm={handleConfirmRevoke}
        title={isRevokeAll ? 'Sign Out All Other Devices' : 'Sign Out Device Session'}
        description={
          isRevokeAll
            ? 'Enter your account password to confirm signing out all other logged-in device sessions.'
            : 'Enter your account password to confirm revoking access for this device session.'
        }
        confirmButtonText={isRevokeAll ? 'Sign Out All Others' : 'Revoke Access'}
      />
    </>
  )
}

export default ActiveSessionsModal
