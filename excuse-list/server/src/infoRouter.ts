import { Router } from 'express';
import { getInfos, saveInfos } from '../data/infoRepository';

const infoRouter = Router();

infoRouter.get('/api/infos', (req, res) => {
  try {
    res.json(getInfos());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load infos' });
  }
});

infoRouter.post('/api/infos', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const infos = getInfos();
    const newInfo = {
      id: Date.now().toString(),
      title: req.body.title || 'Wichtige Info',
      content: req.body.content,
      date: Date.now()
    };
    infos.push(newInfo);
    saveInfos(infos);
    res.json(newInfo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save info' });
  }
});

infoRouter.delete('/api/infos/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    let infos = getInfos();
    infos = infos.filter((i: any) => i.id !== req.params.id);
    saveInfos(infos);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete info' });
  }
});

export default infoRouter;
