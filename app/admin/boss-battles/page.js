const handleSave = async () => {
    if (!form.name || !form.subject) {
      alert('Please fill in name and subject.');
      return;
    }

    let questions = [];
    try {
      questions = JSON.parse(form.questions_json);
      if (!Array.isArray(questions)) throw new Error('Must be an array');
    } catch (e) {
      alert('Invalid JSON in questions field. Must be a valid JSON array.');
      return;
    }

    const data = {
      name: form.name,
      keyword: form.name, // for compatibility
      subject: form.subject,
      topic: form.topic,
      difficulty: parseInt(form.difficulty),
      health: parseInt(form.health),
      questions: questions,
      required_level: parseInt(form.required_level),
      required_xp: parseInt(form.required_xp),
      xp_reward: parseInt(form.reward_xp),
      reward_coins: parseInt(form.reward_coins),
    };

    if (editing) {
      const { error } = await supabase
        .from('boss_battle_drafts')
        .update(data)
        .eq('id', editing);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase
        .from('boss_battle_drafts')
        .insert({ ...data, status: 'draft', generated_from: 'manual' })
        .select();
      if (error) { alert(error.message); return; }
    }

    alert('Boss saved!');
    setEditing(null);
    setForm({ name: '', subject: '', topic: '', difficulty: 1, health: 100, questions_json: '[]', required_level: 1, required_xp: 0, reward_xp: 100, reward_coins: 50 });
    const { data: bossData } = await supabase
      .from('boss_battle_drafts')
      .select('*')
      .order('created_at', { ascending: false });
    setBosses(bossData || []);
  };