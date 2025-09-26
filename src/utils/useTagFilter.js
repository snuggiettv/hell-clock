import { useState } from 'react';
export default function useTagFilter() {
    const [selectedTag, setSelectedTag] = useState('');
    const [tagOptions, setTagOptions] = useState([]);
    return {
        selectedTag,
        setSelectedTag,
        tagOptions,
        setTagOptions,
    };
}
