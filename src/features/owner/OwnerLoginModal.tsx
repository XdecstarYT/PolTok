import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components';
import { OwnerLoginForm } from './OwnerLogin';

export default function OwnerLoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Owner sign-in" width={400}>
      <OwnerLoginForm onSuccess={() => { onClose(); nav('/owner'); }} />
    </Modal>
  );
}
