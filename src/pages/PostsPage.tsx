import { useEffect, useState } from 'react';
import { Box, Alert, Button } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { communityService } from '../services/communityService';
import type { Community, Post } from '../types';
import {
  CommunitySidebar,
  PostsList,
  CommunityLayout,
  CreatePostDialog,
  EditPostDialog,
  CommentDialog,
  LeaveCommunityDialog
} from '../components/community';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const PostsPage = () => {
  const { communityName } = useParams();
  const { user, userRole, isJoined, loading, setUserRole, setIsJoined } = useAuth(communityName);
  const [posts, setPosts] = useState<Post[]>([]);
  const [communityData, setCommunityData] = useState<Community | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{open: boolean, post: Post | null}>({open: false, post: null});
  const [commentDialog, setCommentDialog] = useState<{open: boolean, postId: string}>({open: false, postId: ''});
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [newComment, setNewComment] = useState('');
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [filterByCreator, setFilterByCreator] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const navigate = useNavigate();
  const [comments, setComments] = useState<any[]>([]);
  const [likes, setLikes] = useState<any[]>([]);

  useEffect(() => {
    if (communityName) {
      loadCommunityData();
    }
  }, [communityName]);

  useEffect(() => {
    if (communityData) {
      loadPosts();
    }
  }, [communityData]);

  const loadCommunityData = async () => {
    if (!communityName) return;
    try {
      const community = await communityService.loadCommunityData(communityName);
      if (community) {
        setCommunityData(community);
        // Load member count
        const count = await communityService.getMemberCount(communityName);
        setMemberCount(count);
      } else {
        setError('Community not found');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadPosts = async () => {
    if (!communityData) return;
    try {
      const postsData = await communityService.loadPosts(communityData.id);
      setPosts(postsData);
      // Fetch all comments for these posts
      const postIds = postsData.map((p) => p.id);
      if (postIds.length > 0) {
        const q = query(collection(db, 'comments'), where('postId', 'in', postIds));
        const snap = await getDocs(q);
        setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        // Fetch all likes for these posts
        const likeQ = query(collection(db, 'likes'), where('targetType', '==', 'post'), where('targetId', 'in', postIds));
        const likeSnap = await getDocs(likeQ);
        setLikes(likeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        setComments([]);
        setLikes([]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoinCommunity = async () => {
    if (!user) {
      setError('Please login to join this community');
      return;
    }
    setError('');
    setInfo('');
    try {
      await communityService.joinCommunity(user.uid, communityName!);
      setIsJoined(true);
      setUserRole('member');
      setInfo(`Joined ${communityData?.name || communityName} community! You can now interact with posts and comments.`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeaveCommunity = async () => {
    if (confirmName !== (communityData?.name || communityName)) {
      setError('Community name does not match.');
      return;
    }
    setError('');
    setInfo('');
    try {
      await communityService.leaveCommunity(user!.uid, communityName!);
      setIsJoined(false);
      setUserRole('user');
      setInfo(`Left ${communityData?.name || communityName} community. All your interactions have been deleted.`);
      setLeaveDialog(false);
      setConfirmName('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreatePost = async () => {
    if (!user || !communityData) return;
    setError('');
    try {
      const postData = {
        title: newPost.title,
        content: newPost.content,
        authorId: user.uid,
        authorName: user.displayName || user.email,
        createdAt: new Date(),
        likes: [],
        dislikes: [],
        comments: []
      };
      await communityService.createPost(communityData.id, postData);
      setInfo('Post created!');
      setCreateDialog(false);
      setNewPost({ title: '', content: '' });
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddComment = async () => {
    if (!user || !communityData) return;
    setError('');
    try {
      const commentData = {
        content: newComment,
        authorId: user.uid,
        authorName: user.displayName || user.email,
        createdAt: new Date(),
      };
      await communityService.addComment(communityData.id, commentDialog.postId, commentData);
      setInfo('Comment added!');
      setCommentDialog({open: false, postId: ''});
      setNewComment('');
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLike = async (postId: string, type: 'like' | 'dislike') => {
    if (!user) return;
    if (!isJoined) {
      setError('Please join this community to interact with posts');
      return;
    }
    try {
      await communityService.handleReaction('post', postId, user.uid, type);
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    try {
      await communityService.deletePost(postId);
      setInfo('Post deleted!');
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditPost = (post: Post) => {
    setEditDialog({ open: true, post });
  };

  const handleSavePost = async () => {
    if (!editDialog.post) return;
    setError('');
    try {
      await communityService.updatePost(editDialog.post.id, {
        title: editDialog.post.title,
        content: editDialog.post.content
      });
      setInfo('Post updated!');
      setEditDialog({ open: false, post: null });
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenCommentDialog = (postId: string) => {
    setCommentDialog({ open: true, postId });
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      setInfo('Comment deleted!');
      loadPosts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getFilteredAndSortedPosts = () => {
    let filteredPosts = [...posts];
    
    // Filter by creator if enabled and user is creator
    if (filterByCreator && userRole === 'creator' && user) {
      filteredPosts = filteredPosts.filter(post => post.authorId === user.uid);
    }
    
    // Sort posts by date
    filteredPosts.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      
      if (sortOrder === 'newest') {
        return dateB.getTime() - dateA.getTime();
      } else {
        return dateA.getTime() - dateB.getTime();
      }
    });
    
    return filteredPosts;
  };

  if (loading) return <Box textAlign="center" mt={8}><Alert severity="info">Loading...</Alert></Box>;
  if (!communityName || !communityData) return <Box textAlign="center" mt={8}><Alert severity="error">Community not found</Alert></Box>;

  const sidebar = (
    <CommunitySidebar
      community={communityData}
      memberCount={memberCount}
      postCount={posts.length}
      user={user}
      isJoined={isJoined}
      onJoinCommunity={handleJoinCommunity}
      onLeaveCommunity={() => setLeaveDialog(true)}
    />
  );

  const mainContent = (
    <Box>
      {/* Back to Community Button */}
      <Box mb={2}>
        <Button 
          variant="outlined" 
          onClick={() => navigate(`/c/${communityName}`)}
          sx={{ mb: 2 }}
        >
          ← Back to Community
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}
      
      <PostsList
        posts={getFilteredAndSortedPosts()}
        user={user}
        isJoined={isJoined}
        userRole={userRole}
        onLike={handleLike}
        onComment={handleOpenCommentDialog}
        onDelete={handleDeletePost}
        onEdit={handleEditPost}
        onCreatePost={() => setCreateDialog(true)}
        filterByCreator={filterByCreator}
        onFilterByCreatorChange={setFilterByCreator}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        comments={comments}
        likes={likes}
        onDeleteComment={handleDeleteComment}
      />
    </Box>
  );

  return (
    <Box>
      <CommunityLayout sidebar={sidebar} mainContent={mainContent} />

      {/* Dialogs */}
      <LeaveCommunityDialog
        open={leaveDialog}
        onClose={() => setLeaveDialog(false)}
        communityName={communityData.name}
        confirmName={confirmName}
        onConfirmNameChange={setConfirmName}
        onLeave={handleLeaveCommunity}
      />

      <CreatePostDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        newPost={newPost}
        onNewPostChange={(field, value) => setNewPost({...newPost, [field]: value})}
        onCreatePost={handleCreatePost}
      />

      <EditPostDialog
        open={editDialog.open}
        onClose={() => setEditDialog({open: false, post: null})}
        post={editDialog.post}
        onPostChange={(field, value) => setEditDialog({...editDialog, post: editDialog.post ? {...editDialog.post, [field]: value} : null})}
        onSavePost={handleSavePost}
      />

      <CommentDialog
        open={commentDialog.open}
        onClose={() => setCommentDialog({open: false, postId: ''})}
        comment={newComment}
        onCommentChange={setNewComment}
        onAddComment={handleAddComment}
      />
    </Box>
  );
};

export default PostsPage; 